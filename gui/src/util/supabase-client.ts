import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import storage from 'redux-persist/lib/storage';
import { useAppSelector } from '../redux/hooks';

// Helper function to extract Supabase config from data array
function getSupabaseConfigFromData(data: any[] | undefined) {
  if (!data) return { supabaseUrl: null, supabaseKey: null };
  
  // Look for a data entry with name "supabase" or destination containing "supabase"
  const supabaseEntry = data.find(entry => 
    entry.name === 'supabase' || 
    entry.destination?.includes('supabase') ||
    entry.supabaseUrl // Direct check for supabaseUrl property
  );
  
  if (supabaseEntry) {
    return {
      supabaseUrl: supabaseEntry.supabaseUrl || supabaseEntry.destination,
      supabaseKey: supabaseEntry.supabaseKey || supabaseEntry.apiKey
    };
  }
  
  return { supabaseUrl: null, supabaseKey: null };
}

const storageAdapter = {
  getItem: async (name: string) => {
    return await storage.getItem(`local:${name}`)
  },

  setItem: async (name: string, value: string) => {
    return await storage.setItem(`local:${name}`, value)
  },

  removeItem: async (name: string) => {
    return await storage.removeItem(`local:${name}`)
  },
}

// Custom hook to get Supabase client
export function useSupabase() {
  const config = useAppSelector((state) => state.config.config);

  return useMemo(() => {
    // Get Supabase configuration from config.data (safely access data field)
    const configData = (config as any).data || [];
    const { supabaseUrl, supabaseKey } = getSupabaseConfigFromData(configData);

    try {
      if (supabaseUrl && supabaseKey && supabaseKey !== 'placeholder') {
        return createClient(supabaseUrl, supabaseKey, {
          auth: {
            storageKey: 'anonia-auth-token',
            storage: storageAdapter,
          }
        });
      } else {
        console.warn('Supabase configuration not found in config.data. Anonymization features will be disabled.');
        // Create a mock client to prevent crashes
        return {
          functions: {
            invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
          }
        };
      }
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      // Create a mock client to prevent crashes
      return {
        functions: {
          invoke: () => Promise.resolve({ data: null, error: new Error('Supabase initialization failed') })
        }
      };
    }
  }, [config]);
}

// For backward compatibility, export a function that creates a client with default config
// This should only be used in non-React contexts if absolutely necessary
export function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  try {
    if (supabaseUrl && supabaseKey && supabaseKey !== 'placeholder') {
      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          storageKey: 'anonia-auth-token',
          storage: storageAdapter,
        }
      });
    }
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
  }
  
  return {
    functions: {
      invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    }
  };
}

