import { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscForeground } from "..";
import {
  AnonymizationConfig,
  AnonymizationService,
} from "../../../../custom_proxy/utils/anonymization";
import { useSupabase } from "../../util/supabase-client";

const SettingsContainer = styled.div`
  max-width: 500px;
  background-color: var(--vscode-editor-background);
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 16px;
`;

const SettingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 0;
`;

const SettingLabel = styled.label`
  color: ${vscForeground};
  font-size: 14px;
  cursor: pointer;
  flex: 1;
`;

const SettingDescription = styled.div`
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  margin-top: 4px;
`;

const CheckboxInput = styled.input`
  margin-left: 8px;
  cursor: pointer;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid ${lightGray};
`;

const Button = styled.button<{ variant?: "primary" | "secondary" }>`
  padding: 8px 16px;
  border: none;
  border-radius: ${defaultBorderRadius};
  font-size: 12px;
  cursor: pointer;

  ${(props) =>
    props.variant === "primary"
      ? `
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    &:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  `
      : `
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    &:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
  `}
`;

const Title = styled.h3`
  color: ${vscForeground};
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
`;

interface AnonymizationSettingsProps {
  onSave: (config: AnonymizationConfig) => void;
  onCancel: () => void;
}

export default function AnonymizationSettings({
  onSave,
  onCancel,
}: AnonymizationSettingsProps) {
  const supabaseClient = useSupabase();
  const anonymizationService = new AnonymizationService(supabaseClient);
  const [config, setConfig] = useState<AnonymizationConfig>(
    anonymizationService.getConfig(),
  );

  const handleConfigChange = (
    key: keyof AnonymizationConfig,
    value: boolean,
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    anonymizationService.updateConfig(config);
    onSave(config);
  };

  return (
    <SettingsContainer>
      <Title>Anonymization Settings</Title>

      <SettingItem>
        <div>
          <SettingLabel htmlFor="anonymizeUserInput">
            Anonymize User Input
            <CheckboxInput
              id="anonymizeUserInput"
              type="checkbox"
              checked={config.anonymizeUserInput}
              onChange={(e) =>
                handleConfigChange("anonymizeUserInput", e.target.checked)
              }
            />
          </SettingLabel>
          <SettingDescription>
            Detect and anonymize sensitive information in your messages before
            sending to the LLM
          </SettingDescription>
        </div>
      </SettingItem>

      <SettingItem>
        <div>
          <SettingLabel htmlFor="anonymizeAssistantResponses">
            Anonymize Assistant Responses
            <CheckboxInput
              id="anonymizeAssistantResponses"
              type="checkbox"
              checked={config.anonymizeAssistantResponses}
              onChange={(e) =>
                handleConfigChange(
                  "anonymizeAssistantResponses",
                  e.target.checked,
                )
              }
            />
          </SettingLabel>
          <SettingDescription>
            Detect and anonymize sensitive information in AI responses before
            adding to chat history
          </SettingDescription>
        </div>
      </SettingItem>

      <SettingItem>
        <div>
          <SettingLabel htmlFor="autoDetectSensitiveEntries">
            Auto-Detect Sensitive Information
            <CheckboxInput
              id="autoDetectSensitiveEntries"
              type="checkbox"
              checked={config.autoDetectSensitiveEntries}
              onChange={(e) =>
                handleConfigChange(
                  "autoDetectSensitiveEntries",
                  e.target.checked,
                )
              }
            />
          </SettingLabel>
          <SettingDescription>
            Automatically detect and suggest sensitive entities for
            anonymization
          </SettingDescription>
        </div>
      </SettingItem>

      <SettingItem>
        <div>
          <SettingLabel htmlFor="showConfirmationDialog">
            Show Confirmation Dialog
            <CheckboxInput
              id="showConfirmationDialog"
              type="checkbox"
              checked={config.showConfirmationDialog}
              onChange={(e) =>
                handleConfigChange("showConfirmationDialog", e.target.checked)
              }
            />
          </SettingLabel>
          <SettingDescription>
            Show a preview dialog before sending anonymized messages
          </SettingDescription>
        </div>
      </SettingItem>

      <ButtonContainer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Settings
        </Button>
      </ButtonContainer>
    </SettingsContainer>
  );
}
