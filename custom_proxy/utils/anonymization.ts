import { AnoniaApiClient } from '../../gui/src/util/anoniaApiClient';
import { SensitiveEntryResponse } from './anoniaTypes';

// NEW: Import ChatMessage type
import type { ChatMessage } from '../../core';

export interface AnonymizationResult {
  originalText: string;
  anonymizedText: string;
  anonymizationMap: Record<string, string>;
  newlyCreatedEntries?: SensitiveEntryResponse[];
}

export interface AnonymizationConfig {
  anonymizeUserInput: boolean;
  anonymizeAssistantResponses: boolean;
  showConfirmationDialog: boolean;
  autoDetectSensitiveEntries: boolean;
}

export class AnonymizationService {
  private config: AnonymizationConfig;
  private sensitiveEntries: SensitiveEntryResponse[] = [];
  private supabaseClient: any;

  constructor(supabaseClient: any, config?: Partial<AnonymizationConfig>) {
    this.supabaseClient = supabaseClient;
    this.config = {
      anonymizeUserInput: true,
      anonymizeAssistantResponses: false,
      showConfirmationDialog: true,
      autoDetectSensitiveEntries: true,
      ...config,
    };
    
    // Load existing sensitive entries on initialization (non-blocking)
    this.loadSensitiveEntries().catch(error => {
      console.warn('Failed to load sensitive entries on initialization:', error);
    });
  }

  getConfig(): AnonymizationConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AnonymizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  shouldAnonymizeAssistantResponses(): boolean {
    return this.config.anonymizeAssistantResponses;
  }

  private async loadSensitiveEntries(): Promise<void> {
    try {
      if (!this.supabaseClient || !('auth' in this.supabaseClient)) {
        console.warn('Supabase client not available for loading sensitive entries');
        return;
      }
      const response = await AnoniaApiClient.getSensitiveEntries(this.supabaseClient);
      if (response.data) {
        this.sensitiveEntries = response.data.sensitiveEntries;
      }
    } catch (error) {
      console.error("Failed to load sensitive entries:", error);
    }
  }

  async getSensitiveEntries(): Promise<SensitiveEntryResponse[]> {
    await this.loadSensitiveEntries();
    return this.sensitiveEntries;
  }

  async analyzeMessage(text: string): Promise<SensitiveEntryResponse[]> {
    try {
      if (!this.supabaseClient || !('auth' in this.supabaseClient)) {
        console.warn('Supabase client not available for message analysis');
        throw new Error('Supabase client not available for message analysis');
      }
      const response = await AnoniaApiClient.analyzeMessage(
        { message: text },
        this.supabaseClient
      );
      
      if (response.error) {
        throw new Error('Failed to analyze message');
      }
      
      return response.data?.results || [];
    } catch (error) {
      console.error("Error analyzing message:", error);
      throw new Error('Failed to analyze message');
    }
  }

  async anonymizeText(text: string, customWords?: string[]): Promise<AnonymizationResult> {
    try {
      // First, analyze the message to detect sensitive entities
      let detectedEntries: SensitiveEntryResponse[] = [];
      if (this.config.autoDetectSensitiveEntries) {
        detectedEntries = await this.analyzeMessage(text);
      }
      console.log('detectedEntries', detectedEntries);

      // Get existing sensitive entries
      await this.loadSensitiveEntries();
      
      // Combine existing entries with detected ones
      const allEntryIds = [
        ...this.sensitiveEntries.map(entry => entry.id),
        ...detectedEntries.map(entry => entry.id)
      ];

      console.log('allEntryIds', allEntryIds);

      // Remove duplicates
      const uniqueEntryIds = Array.from(new Set(allEntryIds));

      if (!this.supabaseClient || !('auth' in this.supabaseClient)) {
        console.warn('Supabase client not available for anonymization');
        return {
          originalText: text,
          anonymizedText: text,
          anonymizationMap: {},
          newlyCreatedEntries: []
        };
      }

      // Call anonymization service
      const response = await AnoniaApiClient.anonymizeMessage(
        {
          message: text,
          entryIds: uniqueEntryIds,
          customWords
        },
        this.supabaseClient
      );

      console.log('response', response);

      if (response.error) {
        throw new Error('Anonymization service error');
      }

      const result = response.data!;
      
      // Create anonymization map only from detected entries in current text
      const anonymizationMap: Record<string, string> = {};
      
      // Add mappings for detected entries (existing ones found in current text)
      detectedEntries.forEach(entry => {
        anonymizationMap[entry.sensitiveValue] = entry.anonymizedValue;
      });
      
      // Add mappings for newly created entries
      result.newlyCreatedEntries?.forEach(entry => {
        anonymizationMap[entry.sensitiveValue] = entry.anonymizedValue;
      });

      return {
        originalText: text,
        anonymizedText: result.message,
        anonymizationMap,
        newlyCreatedEntries: result.newlyCreatedEntries,
      };
    } catch (error) {
      console.error("Error calling anonymization service:", error);
      
      throw new Error('Anonymization service error: ' + error);
    }
  }

  // NEW: Deanonymize a chat message by reversing the anonymization mappings
  async deanonymizeMessage(message: ChatMessage): Promise<ChatMessage> {
    try {
      // Only process messages that have content
      if (!message.content) {
        return message;
      }

      // Load the latest sensitive entries to build reverse mapping
      await this.loadSensitiveEntries();

      // Create reverse mapping: anonymized -> sensitive
      const deanonymizationMap: Record<string, string> = {};
      this.sensitiveEntries.forEach(entry => {
        deanonymizationMap[entry.anonymizedValue] = entry.sensitiveValue;
      });

      // If no mappings exist, return original message
      if (Object.keys(deanonymizationMap).length === 0) {
        return message;
      }

      // Handle different message types with their specific content requirements
      if (message.role === 'system' || message.role === 'tool') {
        // System and tool messages only accept string content
        const textContent = typeof message.content === 'string' 
          ? message.content 
          : Array.isArray(message.content) 
            ? (message.content as any[]).map((part: any) => part.type === 'text' ? part.text || '' : '').join('')
            : String(message.content);
        
        const deanonymizedContent = this.applyDeanonymizationToText(textContent, deanonymizationMap);
        
        return {
          ...message,
          content: deanonymizedContent
        };
      } else {
        // User, assistant, and thinking messages can have MessageContent (string | MessagePart[])
        let deanonymizedContent: any;

        if (typeof message.content === 'string') {
          // Simple string content
          deanonymizedContent = this.applyDeanonymizationToText(message.content, deanonymizationMap);
        } else if (Array.isArray(message.content)) {
          // MessagePart[] content
          deanonymizedContent = (message.content as any[]).map((part: any) => {
            if (part.type === 'text' && part.text) {
              return {
                ...part,
                text: this.applyDeanonymizationToText(part.text, deanonymizationMap)
              };
            }
            return part;
          });
        } else {
          // Fallback for any other content type
          deanonymizedContent = message.content;
        }

        // Return new message with deanonymized content
        return {
          ...message,
          content: deanonymizedContent
        };
      }

    } catch (error) {
      console.error("Error deanonymizing message:", error);
      // Return original message if deanonymization fails
      return message;
    }
  }

  // Helper method to apply deanonymization to text
  private applyDeanonymizationToText(text: string, deanonymizationMap: Record<string, string>): string {
    let deanonymizedText = text;
    
    // Replace each anonymized value with its original sensitive value
    // Sort by length (descending) to handle longer matches first and avoid partial replacements
    const sortedAnonymizedValues = Object.keys(deanonymizationMap)
      .sort((a, b) => b.length - a.length);

    for (const anonymizedValue of sortedAnonymizedValues) {
      const sensitiveValue = deanonymizationMap[anonymizedValue];
      // Use global regex to replace all occurrences
      const regex = new RegExp(this.escapeRegex(anonymizedValue), 'g');
      deanonymizedText = deanonymizedText.replace(regex, sensitiveValue);
    }

    return deanonymizedText;
  }

  // Helper method to escape special regex characters
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async addSensitiveEntries(words: string[]): Promise<SensitiveEntryResponse[]> {
    try {
      if (!this.supabaseClient || !('auth' in this.supabaseClient)) {
        console.warn('Supabase client not available for adding sensitive entries');
        return [];
      }
      const response = await AnoniaApiClient.addSensitiveEntries(
        { words: words.map(word => ({ value: word })) },
        this.supabaseClient
      );

      if (response.error) {
        throw new Error('Failed to add sensitive entries');
      }

      // Reload sensitive entries
      await this.loadSensitiveEntries();
      
      return response.data?.results || [];
    } catch (error) {
      console.error("Error adding sensitive entries:", error);
      throw error;
    }
  }

  async removeSensitiveEntries(ids: string[]): Promise<string[]> {
    try {
      if (!this.supabaseClient || !('auth' in this.supabaseClient)) {
        console.warn('Supabase client not available for removing sensitive entries');
        return [];
      }
      const response = await AnoniaApiClient.removeSensitiveEntries(
        { ids },
        this.supabaseClient
      );

      if (response.error) {
        throw new Error('Failed to remove sensitive entries');
      }

      // Reload sensitive entries
      await this.loadSensitiveEntries();
      
      return response.data?.deletedIds || [];
    } catch (error) {
      console.error("Error removing sensitive entries:", error);
      throw error;
    }
  }
}

// Factory function to create AnonymizationService with supabase client
export function createAnonymizationService(supabaseClient: any, config?: Partial<AnonymizationConfig>): AnonymizationService {
  return new AnonymizationService(supabaseClient, config);
}
