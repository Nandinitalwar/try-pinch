import { TrainingExample } from './trainingData'

export type DatasetSplit = 'train' | 'validation'

function stableBucket(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0x100000000
}

export function exampleGroup(example: TrainingExample): string {
  // New captures carry a one-way conversation identifier. For legacy files,
  // keep identical prompt contexts together instead of splitting per row.
  return example.groupId || `legacy:${example.systemPrompt}`
}

export function splitForExample(example: TrainingExample, validationRatio = 0.1): DatasetSplit {
  if (!(validationRatio > 0 && validationRatio < 1)) throw new Error('validation ratio must be between 0 and 1')
  return stableBucket(exampleGroup(example)) < validationRatio ? 'validation' : 'train'
}

export function selectCleanExamples(examples: TrainingExample[]): TrainingExample[] {
  // Callers supply the checker because this module stays independent of voice rules;
  // this helper only rejects known capture failures and empty targets.
  return examples.filter(example => example.chosen.trim().length > 0)
}
