'use client';

export const MODEL_OPTIONS = [
  { id: 'z-ai/glm-5.2', label: 'GLM 5.2' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'openai/gpt-5.4', label: 'GPT-5.4' },
  { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]['id'];

export function ModelPicker({ value, onChange, disabled }: {
  value: ModelId;
  onChange: (model: ModelId) => void;
  disabled?: boolean;
}) {
  return (
    <label className="model-picker">
      <span className="model-spark" aria-hidden="true">✦</span>
      <span className="model-label">oracle</span>
      <select
        aria-label="Choose the model behind Pinch"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ModelId)}
      >
        {MODEL_OPTIONS.map((model) => (
          <option key={model.id} value={model.id}>{model.label}</option>
        ))}
      </select>
    </label>
  );
}
