import { SupabaseClient } from '@supabase/supabase-js';
import {
  AddSensitiveEntriesRequest,
  AddSensitiveEntriesResponse,
  AnalyzeMessageRequest,
  AnalyzeMessageResponse,
  AnonymizeMessageRequest,
  AnonymizeMessageResponse,
  FunctionsResponse,
  GetEntitiesCategoriesResponse,
  GetSensitiveEntriesResponse,
  RemoveSensitiveEntriesRequest,
  RemoveSensitiveEntriesResponse,
} from '../../../custom_proxy/utils/anoniaTypes';

export class AnoniaApiClient {
  static getSensitiveEntries(
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<GetSensitiveEntriesResponse>> {
    return supabase.functions.invoke<GetSensitiveEntriesResponse>(
      'get-sensitive-entries',
      { method: 'GET' },
    );
  }

  static getEntitiesCategories(
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<GetEntitiesCategoriesResponse>> {
    return supabase.functions.invoke<GetEntitiesCategoriesResponse>(
      'get-entities-categories',
      { method: 'GET' },
    );
  }

  static analyzeMessage(
    request: AnalyzeMessageRequest,
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<AnalyzeMessageResponse>> {
    return supabase.functions.invoke<AnalyzeMessageResponse>(
      'analyze-message',
      {
        method: 'POST',
        body: request,
      },
    );
  }

  static async addSensitiveEntries(
    request: AddSensitiveEntriesRequest,
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<AddSensitiveEntriesResponse>> {
    return supabase.functions.invoke<AddSensitiveEntriesResponse>(
      'add-sensitive-entries',
      {
        method: 'POST',
        body: request,
      },
    );
  }

  static async removeSensitiveEntries(
    request: RemoveSensitiveEntriesRequest,
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<RemoveSensitiveEntriesResponse>> {
    return supabase.functions.invoke<RemoveSensitiveEntriesResponse>(
      'remove-sensitive-entries',
      {
        method: 'POST',
        body: request,
      },
    );
  }

  static async anonymizeMessage(
    request: AnonymizeMessageRequest,
    supabase: SupabaseClient,
  ): Promise<FunctionsResponse<AnonymizeMessageResponse>> {
    return supabase.functions.invoke<AnonymizeMessageResponse>(
      'anonymize-message',
      {
        method: 'POST',
        body: request,
      },
    );
  }

  static subscribeToSensitiveEntriesChanges(
    supabase: SupabaseClient,
    onChange: () => void,
  ) {
    return supabase
      .channel('anonia_sensitive_entries_changes')
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'anonia_sensitive_entries',
          event: '*',
        },
        () => {
          onChange();
        },
      )
      .subscribe();
  }
}