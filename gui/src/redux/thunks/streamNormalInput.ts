import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, LLMFullCompletionOptions } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { ToCoreProtocol } from "core/protocol";
import { renderChatMessage } from "core/util/messageContent";
import { createAnonymizationService } from "../../../../custom_proxy/utils/anonymization";
import { createSupabaseClient } from "../../util/supabase-client";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
    abortStream,
    addPromptCompletionPair,
    setToolGenerated,
    streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { callCurrentTool } from "./callCurrentTool";

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

// Helper function to anonymize assistant messages
async function anonymizeAssistantMessages(messages: ChatMessage[], config: any): Promise<ChatMessage[]> {
  // Get Supabase configuration from config.data
  const configData = (config as any).data || [];
  const { supabaseUrl, supabaseKey } = getSupabaseConfigFromData(configData);
  
  if (!supabaseUrl || !supabaseKey) {
    return messages; // Return original messages if no supabase config
  }
  
  const supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);
  const anonymizationService = createAnonymizationService(supabaseClient);
  
  // Check if assistant response anonymization is enabled
  if (!anonymizationService.shouldAnonymizeAssistantResponses()) {
    return messages;
  }

  const anonymizedMessages = await Promise.all(
    messages.map(async (message) => {
      if (message.role === "assistant" && message.content) {
        try {
          // Convert MessageContent to string using renderChatMessage
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
          // Return original message if anonymization fails
        }
      }
      return message;
    })
  );
  return anonymizedMessages;
}

export const streamNormalInput = createAsyncThunk<
  void,
  {
    messages: ChatMessage[];
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async (
    { messages, legacySlashCommandData },
    { dispatch, extra, getState },
  ) => {
    // Gather state
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    const streamAborter = state.session.streamAborter;
    if (!selectedChatModel) {
      throw new Error("Default model not defined");
    }

    let completionOptions: LLMFullCompletionOptions = {};
    const activeTools = selectActiveTools(state);
    const toolsSupported = modelSupportsTools(selectedChatModel);
    if (toolsSupported && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    // Send request
    const gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages,
        legacySlashCommandData,
      },
      streamAborter.signal,
    );

    // Stream response
    let next = await gen.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      // NEW: Anonymize assistant responses before updating history
      const anonymizedMessages = await anonymizeAssistantMessages(next.value, getState().config.config);
      dispatch(streamUpdate(anonymizedMessages));
      
      next = await gen.next();
    }

    // Attach prompt log and end thinking for reasoning models
    if (next.done && next.value) {
      dispatch(addPromptCompletionPair([next.value]));

      try {
        if (state.session.mode === "chat" || state.session.mode === "agent") {
          extra.ideMessenger.post("devdata/log", {
            name: "chatInteraction",
            data: {
              prompt: next.value.prompt,
              completion: next.value.completion,
              modelProvider: selectedChatModel.underlyingProviderName,
              modelTitle: selectedChatModel.title,
              sessionId: state.session.id,
            },
          });
        }
        // else if (state.session.mode === "edit") {
        //   extra.ideMessenger.post("devdata/log", {
        //     name: "editInteraction",
        //     data: {
        //       prompt: next.value.prompt,
        //       completion: next.value.completion,
        //       modelProvider: selectedChatModel.provider,
        //       modelTitle: selectedChatModel.title,
        //     },
        //   });
        // }
      } catch (e) {
        console.error("Failed to send dev data interaction log", e);
      }
    }

    // If it's a tool call that is automatically accepted, we should call it
    const newState = getState();
    const toolSettings = newState.ui.toolSettings;
    const toolCallState = selectCurrentToolCall(newState);
    if (toolCallState) {
      dispatch(
        setToolGenerated({
          toolCallId: toolCallState.toolCallId,
        }),
      );

      if (
        toolSettings[toolCallState.toolCall.function.name] ===
        "allowedWithoutPermission"
      ) {
        const response = await dispatch(callCurrentTool());
        unwrapResult(response);
      }
    }
  },
);
