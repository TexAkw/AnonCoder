import { createAsyncThunk } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  MessageModes,
  RangeInFileWithContents,
  SetCodeToEditPayload,
} from "core";
import { stripImages } from "core/util/messageContent";
import React from "react";
import AnonymizationConfirmDialog from "../../components/dialogs/AnonymizationConfirmDialog";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor";
import { anonymizationService } from "../../util/anonymization";
import {
  clearCodeToEdit,
  INITIAL_EDIT_APPLY_STATE,
  setPreviousModeEditorContent,
  setReturnToModeAfterEdit,
  updateEditStateApplyState,
} from "../slices/editState";
import {
  newSession,
  setActive,
  setIsInEdit,
  setMainEditorContentTrigger,
  setMode,
} from "../slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { loadLastSession, saveCurrentSession } from "./session";
import { streamThunkWrapper } from "./streamThunkWrapper";

export const streamEditThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    codeToEdit: SetCodeToEditPayload[];
  },
  ThunkApiType
>(
  "chat/streamResponse",
  async ({ editorState, codeToEdit }, { dispatch, extra, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        dispatch(setActive());
        const [contextItems, __, userInstructions, _] =
          await resolveEditorContent({
            editorState,
            modifiers: {
              noContext: true,
              useCodebase: false,
            },
            ideMessenger: extra.ideMessenger,
            defaultContextProviders: [],
            availableSlashCommands: [],
            dispatch,
          });

        const userPrompt = [
          ...contextItems.map((item) => item.content),
          stripImages(userInstructions),
        ].join("\n\n");

        const rangeInFile = codeToEdit[0] as RangeInFileWithContents;

        // Get model for context length calculation (same logic as in VsCodeMessenger)
        const state = getState();
        const config = state.config.config;
        const model =
          config?.selectedModelByRole?.edit ??
          config?.selectedModelByRole?.chat;

        if (!model) {
          throw new Error("No Edit or Chat model selected");
        }

        // Extract prefix/suffix/rangeContent using original methods before anonymization
        let prefix = "";
        let suffix = "";
        let rangeContent = rangeInFile.contents;

        try {
          // Use the new protocol method to extract content with original methods
          const extractedContent = await extra.ideMessenger.request(
            "edit/extractContent",
            {
              range: rangeInFile,
              contextLength: model.contextLength || 8192,
              model: model.model,
            },
          );

          if (extractedContent.status === "error") {
            throw new Error(extractedContent.error);
          }

          prefix = extractedContent.content.prefix;
          suffix = extractedContent.content.suffix;
          rangeContent = extractedContent.content.rangeContent;
        } catch (error) {
          console.error("Error extracting content for anonymization:", error);
          // Continue with just the selected text
          rangeContent = rangeInFile.contents;
          prefix = "";
          suffix = "";
        }

        // NEW: Anonymization workflow for edit mode
        try {
          // Combine all text content for anonymization
          const textContents = [
            userPrompt && `User prompt:\n${userPrompt}`,
            prefix && `Prefix:\n${prefix}`,
            rangeContent && `Selected code:\n${rangeContent}`,
            suffix && `Suffix:\n${suffix}`,
          ]
            .filter(Boolean)
            .join("\n\n");

          // Call anonymization service
          const anonymizationResult =
            await anonymizationService.anonymizeText(textContents);

          // Show confirmation dialog
          const confirmed = await new Promise<boolean>((resolve) => {
            const handleConfirm = () => {
              dispatch(setShowDialog(false));
              resolve(true);
            };

            const handleCancel = () => {
              dispatch(setShowDialog(false));
              resolve(false);
            };

            dispatch(
              setDialogMessage(
                React.createElement(AnonymizationConfirmDialog, {
                  anonymizationResult,
                  onConfirm: handleConfirm,
                  onCancel: handleCancel,
                }),
              ),
            );
            dispatch(setShowDialog(true));
          });

          if (!confirmed) {
            return; // User cancelled
          }

          // If confirmed and there are changes, use anonymized content
          if (Object.keys(anonymizationResult.anonymizationMap).length > 0) {
            // Apply anonymization to each piece of content
            let anonymizedPrompt = userPrompt;
            let anonymizedPrefix = prefix;
            let anonymizedSuffix = suffix;
            let anonymizedRangeContent = rangeContent;

            // Apply anonymization mapping to each content piece
            for (const [placeholder, original] of Object.entries(
              anonymizationResult.anonymizationMap,
            )) {
              const escapedOriginal = original.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              );
              const regex = new RegExp(escapedOriginal, "g");

              anonymizedPrompt = anonymizedPrompt.replace(regex, placeholder);
              anonymizedPrefix = anonymizedPrefix.replace(regex, placeholder);
              anonymizedSuffix = anonymizedSuffix.replace(regex, placeholder);
              anonymizedRangeContent = anonymizedRangeContent.replace(
                regex,
                placeholder,
              );
            }

            // Send anonymized content with pre-extracted data
            const response = await extra.ideMessenger.request(
              "edit/sendPrompt",
              {
                prompt: anonymizedPrompt,
                range: rangeInFile,
                preExtracted: {
                  prefix: anonymizedPrefix,
                  suffix: anonymizedSuffix,
                  rangeContent: anonymizedRangeContent,
                },
              },
            );

            if (response.status === "error") {
              throw new Error(response.error);
            }
            return;
          }
        } catch (error) {
          console.error("Anonymization failed:", error);
          // Show error to user and optionally proceed without anonymization
          const proceed = confirm(
            "Anonymization service failed. Do you want to proceed without anonymization?",
          );
          if (!proceed) {
            return;
          }
        }

        // Original flow (if no anonymization or anonymization failed and user chose to proceed)
        const response = await extra.ideMessenger.request("edit/sendPrompt", {
          prompt: userPrompt,
          range: rangeInFile,
        });

        if (response.status === "error") {
          throw new Error(response.error);
        }
      }),
    );
  },
);

export const exitEdit = createAsyncThunk<
  void,
  { goToMode?: MessageModes; openNewSession?: boolean },
  ThunkApiType
>(
  "edit/exit",
  async ({ goToMode, openNewSession }, { dispatch, extra, getState }) => {
    const state = getState();
    const codeToEdit = state.editModeState.codeToEdit;
    const isInEdit = state.session.isInEdit;
    const previousModeEditorContent =
      state.editModeState.previousModeEditorContent;

    if (!isInEdit) {
      return;
    }

    if (codeToEdit[0] && state.editModeState.applyState.numDiffs) {
      extra.ideMessenger.post("rejectDiff", {
        filepath: codeToEdit[0].filepath,
      });
    }

    extra.ideMessenger.post("edit/clearDecorations", undefined);

    dispatch(clearCodeToEdit());
    dispatch(updateEditStateApplyState(INITIAL_EDIT_APPLY_STATE));
    dispatch(setIsInEdit(false));

    // Restore the previous editor content if available
    if (previousModeEditorContent) {
      dispatch(setMainEditorContentTrigger(previousModeEditorContent));
      dispatch(setPreviousModeEditorContent(undefined));
    }

    if (openNewSession || state.editModeState.lastNonEditSessionWasEmpty) {
      dispatch(newSession());
    } else {
      await dispatch(
        loadLastSession({
          saveCurrentSession: false,
        }),
      );
    }

    dispatch(setMode(goToMode ?? state.editModeState.returnToMode));
  },
);

export const enterEdit = createAsyncThunk<
  void,
  { returnToMode?: MessageModes; editorContent?: JSONContent },
  ThunkApiType
>(
  "edit/enter",
  async ({ returnToMode, editorContent }, { dispatch, extra, getState }) => {
    const state = getState();
    const isInEdit = state.session.isInEdit;

    if (isInEdit) {
      return;
    }

    dispatch(setMainEditorContentTrigger({}));
    dispatch(setPreviousModeEditorContent(editorContent));

    dispatch(setReturnToModeAfterEdit(returnToMode ?? state.session.mode));
    dispatch(updateEditStateApplyState(INITIAL_EDIT_APPLY_STATE));

    await dispatch(
      saveCurrentSession({
        openNewSession: true,
        // Because this causes a lag before Edit is focused. TODO just have that happen in background
        generateTitle: false,
      }),
    );

    dispatch(setIsInEdit(true));

    if (!state.editModeState.codeToEdit[0]) {
      extra.ideMessenger.post("edit/addCurrentSelection", undefined);
    }
  },
);
