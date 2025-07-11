import { Middleware } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { createAnonymizationService } from "../../../../custom_proxy/utils/anonymization";
import { createSupabaseClient } from "../../util/supabase-client";
import { streamUpdate } from "../slices/sessionSlice";
import { RootState } from "../store";

// Helper function to extract Supabase config from data array
function getSupabaseConfigFromData(data: any[] | undefined) {
  if (!data) return { supabaseUrl: null, supabaseKey: null };
  
  const supabaseEntry = data.find(entry => 
    entry.name === 'supabase' || 
    entry.destination?.includes('supabase') ||
    entry.supabaseUrl
  );
  
  if (supabaseEntry) {
    return {
      supabaseUrl: supabaseEntry.supabaseUrl || supabaseEntry.destination,
      supabaseKey: supabaseEntry.supabaseKey || supabaseEntry.apiKey
    };
  }
  
  return { supabaseUrl: null, supabaseKey: null };
}

// Redux middleware to anonymize assistant responses
export const anonymizationMiddleware: Middleware<{}, RootState> = 
  (store) => (next) => async (action) => {
    // Check if this is a streamUpdate action with assistant messages
    if (streamUpdate.match(action)) {
      try {
        // Get Supabase configuration from Redux state
        const state = store.getState();
        const configData = (state.config.config as any).data || [];
        const { supabaseUrl, supabaseKey } = getSupabaseConfigFromData(configData);
        
        if (!supabaseUrl || !supabaseKey) {
          // Continue with original action if no supabase config
          return next(action);
        }
        
        const supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);
        const anonymizationService = createAnonymizationService(supabaseClient);
        
        const messages: ChatMessage[] = action.payload;
        const anonymizedMessages = await Promise.all(
          messages.map(async (message) => {
            if (message.role === "assistant" && message.content) {
              try {
                const messageText = renderChatMessage(message);
                if (messageText.trim()) {
                  const result = await anonymizationService.anonymizeText(messageText);
                  return {
                    ...message,
                    content: result.anonymizedText,
                  };
                }
              } catch (error) {
                console.error("Failed to anonymize assistant response:", error);
              }
            }
            return message;
          })
        );

        // Create new action with anonymized messages
        const anonymizedAction = {
          ...action,
          payload: anonymizedMessages,
        };

        return next(anonymizedAction);
      } catch (error) {
        console.error("Anonymization middleware error:", error);
        // Continue with original action if anonymization fails
        return next(action);
      }
    }

    // For all other actions, pass through normally
    return next(action);
  }; 