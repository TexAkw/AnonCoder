import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscForeground } from "..";
import { AnonymizationResult } from "../../util/anonymization";

const DialogContainer = styled.div`
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  background-color: var(--vscode-editor-background);
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 16px;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  color: ${vscForeground};
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
`;

const TextBox = styled.div`
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: ${defaultBorderRadius};
  padding: 12px;
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 150px;
  overflow-y: auto;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
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

const ChangesBox = styled.div`
  background-color: var(--vscode-textCodeBlock-background);
  border: 1px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 8px;
  font-size: 11px;
  max-height: 100px;
  overflow-y: auto;
`;

const ChangeItem = styled.div`
  margin: 4px 0;
  color: ${vscForeground};
`;

interface AnonymizationConfirmDialogProps {
  anonymizationResult: AnonymizationResult;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AnonymizationConfirmDialog({
  anonymizationResult,
  onConfirm,
  onCancel,
}: AnonymizationConfirmDialogProps) {
  const { originalText, anonymizedText, anonymizationMap } =
    anonymizationResult;
  const hasChanges = Object.keys(anonymizationMap).length > 0;

  return (
    <DialogContainer>
      <Section>
        <SectionTitle>Text Anonymization Preview</SectionTitle>
        <p
          style={{
            color: vscForeground,
            fontSize: "12px",
            margin: "0 0 12px 0",
          }}
        >
          Your message has been processed for anonymization. Please review the
          changes below and confirm if you want to send the anonymized version.
        </p>
      </Section>

      <Section>
        <SectionTitle>Original Message:</SectionTitle>
        <TextBox>{originalText}</TextBox>
      </Section>

      <Section>
        <SectionTitle>Anonymized Message:</SectionTitle>
        <TextBox>{anonymizedText}</TextBox>
      </Section>

      {hasChanges && (
        <Section>
          <SectionTitle>Detected Changes:</SectionTitle>
          <ChangesBox>
            {Object.entries(anonymizationMap).map(([placeholder, original]) => (
              <ChangeItem key={placeholder}>
                <strong>{original}</strong> → {placeholder}
              </ChangeItem>
            ))}
          </ChangesBox>
        </Section>
      )}

      {!hasChanges && (
        <Section>
          <p
            style={{
              color: vscForeground,
              fontSize: "12px",
              fontStyle: "italic",
            }}
          >
            No sensitive information detected. The message will be sent as-is.
          </p>
        </Section>
      )}

      <ButtonContainer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {hasChanges ? "Send Anonymized Message" : "Send Message"}
        </Button>
      </ButtonContainer>
    </DialogContainer>
  );
}
