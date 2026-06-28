---
name: query-bar
description: Use when building or modifying the Love AI query bar — the core UI component. Covers structure, buttons, mode switching, and model picker.
created: 2026-06-22
updated: 2026-06-22
tags: [frontend, ux, query-bar, modes]
---

# Query Bar Architecture

## When to Use
- Building or changing anything in the query bar
- Adding a new mode or button
- Changing the model picker behavior
- Don't use when: working on the chat response rendering

## Structure

Visual reference:
- **Bones/layout**: Google Gemini query bar (centered, dark, minimal, full-width on landing)
- **Buttons**: Claude-style (compact, bottom of textarea)

```
┌─────────────────────────────────────────────────────────┐
│  [textarea — expands on input, multi-line]               │
│                                                          │
│  [Model Picker ▾]  [⚡ Fusion]  [🤖 Agent]    [→ Send] │
└─────────────────────────────────────────────────────────┘
```

## Three Buttons

### 1. Model Picker (always visible)
- Dropdown: scrollable list of OpenRouter models
- Search input at top of dropdown
- Default: `openrouter/auto` (pinned first)
- Selection persists per conversation
- Selected model shared with Agent mode

### 2. Fusion (toggle)
- Click activates Fusion mode; click again deactivates
- Expands an inline sub-panel with two side-by-side model pickers
- Each picker: same scrollable + searchable list as main Model Picker
- Only one of Fusion / Agent can be active at a time (activating one deactivates the other)

### 3. Agent (toggle)
- Click activates MAS mode; click again deactivates
- Uses the model from the main Model Picker for all agent steps
- No extra UI in the query bar — just the button state changes

## Mode Mutual Exclusivity
```
Simple UI: always on (base layer)
Fusion: toggle — disables Agent when activated
Agent: toggle — disables Fusion when activated
```

## State Shape (Zustand)
```ts
{
  mode: 'simple' | 'fusion' | 'agent',
  selectedModel: string,           // for simple + agent
  fusionModels: [string, string],  // for fusion
  inputValue: string,
}
```

## Pitfalls
- Don't render Fusion sub-panel outside the query bar — it lives inline, below the textarea
- Model picker search should filter by model name AND provider
- BYOK badge should appear near the Model Picker button when active

## Verification
- [ ] All three buttons render in correct order
- [ ] Fusion and Agent are mutually exclusive
- [ ] Model picker search filters correctly
- [ ] Selected model updates shared Zustand state
- [ ] Fusion sub-panel opens/closes cleanly with no layout shift
