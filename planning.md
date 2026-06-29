# Provenance Guard Planning

## Project Goal

Provenance Guard is a backend system for creative sharing platforms. It helps classify whether submitted text appears AI-generated, human-written, or uncertain. The system does not try to perfectly police creativity. Instead, it gives readers context, communicates uncertainty, records decisions, and gives creators a path to appeal.

## Architecture

A creator submits a piece of text through the API. The backend sends it through a detection pipeline with two independent signals. The two signal scores are combined into a single confidence score, which drives a transparency label shown to the reader. Every decision is written to a structured audit log. If a creator disagrees with the result, they can submit an appeal — this updates the content status to under review and appends the appeal to the audit log.

### Submission flow

```
POST /submit  (text + creator_id)
        │
        ▼
  Rate limiter  (Flask-Limiter)
        │
        ▼
  ┌─────────────────────────────────────────┐
  │           Detection pipeline            │
  │                                         │
  │   LLM classifier      Stylometric       │
  │   Groq — semantic     signal            │
  │   + style score       TTR, variance,    │
  │                       density score     │
  └──────────┬─────────────────┬────────────┘
             │   signal scores  │
             └────────┬─────────┘
                      ▼
             Confidence scorer
             combines both scores → 0.0–1.0
                      │
                      ▼
             Transparency label builder
             high-confidence human / high-confidence AI / uncertain → plain text
                      │
                      ▼
             Audit log  (SQLite)
             decision + signals + label + timestamp
                      │
                      ▼
             API response
```

### Appeal flow

```
POST /appeal  (content_id + creator reasoning)
        │
        ▼
  Lookup original decision
  fetch from audit log by content_id
        │
        ▼
  Status update
  content status → "under review"
        │
        ▼
  Audit log  (SQLite)
  appeal_id + reason + timestamp appended
        │
        ▼
  API response  (appeal confirmed)
```

## Detection Signals

### Signal 1: LLM-based classification

This signal uses Groq's LLM to evaluate whether the text appears more human-written or AI-generated.

Output: a float between 0.0 and 1.0 representing AI-likelihood.

It captures: tone, phrasing, coherence, semantic flow, and overall writing style.

Why I chose it: The LLM can assess the text holistically instead of only counting surface-level features.

Blind spot: LLMs are not proof of authorship. They may misclassify polished human writing as AI-generated or fail to catch heavily edited AI writing.

### Signal 2: Stylometric heuristics

This signal uses pure Python calculations to analyze measurable writing patterns.

Output: a float between 0.0 and 1.0 representing AI-likelihood, derived from normalized feature scores.

It captures: sentence length variance, vocabulary diversity (type-token ratio), punctuation density, and average sentence length.

Why I chose it: This signal is independent from the LLM. It looks at structure instead of meaning, so it adds a different kind of evidence.

Blind spot: Human writers can write in a clean, uniform style, and AI-generated text can be edited to look more varied.

## False Positive Scenario

A false positive happens when a human creator's original writing is labeled as AI-generated. This is harmful because it damages trust between the creator and the platform.

To reduce this risk, the system should be conservative. It should only show a high-confidence AI label when the score is clearly high. If the score is near the middle, the system should return an uncertain label instead of accusing the creator.

The appeal workflow gives creators a way to contest a classification. When an appeal is submitted, the content status changes to under review and the creator's reasoning is saved in the audit log.

## API Surface

### POST /submit

Accept text content for attribution analysis.

Request body:
```json
{
  "creator_id": "creator_123",
  "text": "Submitted poem, short story, or blog post text."
}
```

Response body:
```json
{
  "content_id": "generated-content-id",
  "result": "Likely AI-generated | Likely human-written | Uncertain",
  "confidence": 0.82,
  "ai_score": 0.82,
  "signals": [
    { "name": "llm_classifier", "score": 0.85 },
    { "name": "stylometric_heuristics", "score": 0.78 }
  ],
  "transparency_label": "Reader-facing label text."
}
```

### POST /appeal

Allow creators to contest a classification.

Request body:
```json
{
  "creator_id": "creator_123",
  "content_id": "generated-content-id",
  "reason": "I wrote this myself and can provide earlier drafts."
}
```

Response body:
```json
{
  "appeal_id": "generated-appeal-id",
  "content_id": "generated-content-id",
  "status": "under review",
  "message": "Appeal received."
}
```

### GET /log

Return the structured audit log.

Response body:
```json
[
  {
    "event_type": "attribution_decision",
    "content_id": "generated-content-id",
    "result": "Uncertain",
    "confidence": 0.54,
    "ai_score": 0.54,
    "signals": [
      { "name": "llm_classifier", "score": 0.50 },
      { "name": "stylometric_heuristics", "score": 0.60 }
    ],
    "transparency_label": "Uncertain: Our system could not confidently determine whether this content was written by a human or generated by AI.",
    "timestamp": "2026-06-28T00:00:00Z"
  }
]
```
