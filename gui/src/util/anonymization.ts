export interface AnonymizationResult {
  originalText: string;
  anonymizedText: string;
  anonymizationMap: Record<string, string>;
}

export interface AnonymizationRequest {
  text: string;
}

export class AnonymizationService {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:7002") {
    this.baseUrl = baseUrl;
  }

  async anonymizeText(text: string): Promise<AnonymizationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/anonymize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Anonymization service error: ${response.status}`);
      }

      const result = await response.json();
      return {
        originalText: result.original_text,
        anonymizedText: result.anonymized_text,
        anonymizationMap: result.anonymization_map,
      };
    } catch (error) {
      console.error("Error calling anonymization service:", error);
      throw new Error(
        "Failed to anonymize text. Please check if the anonymization service is running.",
      );
    }
  }
}

export const anonymizationService = new AnonymizationService();
