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
  "result": "Likely AI-generated",
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
    "content_id": "content-001",
    "result": "Likely human-written",
    "confidence": 0.88,
    "ai_score": 0.12,
    "signals": [
      { "name": "llm_classifier", "score": 0.10 },
      { "name": "stylometric_heuristics", "score": 0.14 }
    ],
    "transparency_label": "Likely human-written: Our system found strong indicators that this content was written by a human creator.",
    "timestamp": "2026-06-28T10:00:00Z"
  },
  {
    "event_type": "attribution_decision",
    "content_id": "content-002",
    "result": "Uncertain",
    "confidence": 0.54,
    "ai_score": 0.54,
    "signals": [
      { "name": "llm_classifier", "score": 0.50 },
      { "name": "stylometric_heuristics", "score": 0.58 }
    ],
    "transparency_label": "Uncertain: Our system could not confidently determine whether this content was written by a human or generated by AI.",
    "timestamp": "2026-06-28T10:15:00Z"
  },
  {
    "event_type": "attribution_decision",
    "content_id": "content-003",
    "result": "Likely AI-generated",
    "confidence": 0.86,
    "ai_score": 0.86,
    "signals": [
      { "name": "llm_classifier", "score": 0.90 },
      { "name": "stylometric_heuristics", "score": 0.82 }
    ],
    "transparency_label": "Likely AI-generated: Our system found strong indicators that this content may have been generated by AI. Because AI detection can be imperfect, the creator may appeal this classification.",
    "timestamp": "2026-06-28T10:30:00Z"
  }
]
```





## Milestone 2: Implementation Spec

This section turns the Milestone 1 architecture into an implementation-ready plan. The goal is to define the exact signal outputs, confidence scoring rules, transparency labels, appeal behavior, edge cases, and AI tool usage before writing code.

## Confidence Scoring and Uncertainty Representation

The system will treat the final score as an AI-likelihood score from `0.0` to `1.0`.

* `0.0` means very likely human-written.
* `1.0` means very likely AI-generated.
* Scores near `0.5` mean the system is uncertain.

The two signal scores will be combined using equal weighting:

```text
combined_ai_score = (0.5 * llm_classifier_score) + (0.5 * stylometric_heuristics_score)
```

I chose equal weighting because the two signals measure different kinds of evidence. The LLM classifier looks at meaning, tone, phrasing, and coherence. The stylometric signal looks at measurable structure, such as type-token ratio, sentence length variance, punctuation density, and average sentence length.

If the two signals strongly disagree, the combined score should fall into the uncertain range. For example:

```text
LLM score = 0.90
Stylometric score = 0.30
Combined score = 0.60
Result = Uncertain
```

This is intentional. Mixed evidence should not produce a confident label.

### Thresholds

The system will map scores to labels using these thresholds:

| Score range | Result               |
| ----------- | -------------------- |
| `0.00–0.25` | Likely human-written |
| `0.26–0.79` | Uncertain            |
| `0.80–1.00` | Likely AI-generated  |

The threshold for AI-generated content is intentionally higher because a false positive is harmful. If a human creator's original work is incorrectly labeled as AI-generated, it can damage trust and reputation. Because of that, the system should only show a high-confidence AI label when the evidence is strong.

## Transparency Label Design

The system will return one of three reader-facing label variants.

| Variant               | Exact label text                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-confidence AI    | "Likely AI-generated: Our system found strong indicators that this content may have been generated by AI. Because AI detection can be imperfect, the creator may appeal this classification." |
| High-confidence human | "Likely human-written: Our system found strong indicators that this content was written by a human creator."                                                                                  |
| Uncertain             | "Uncertain: Our system could not confidently determine whether this content was written by a human or generated by AI."                                                                       |

These labels are written in plain language so a non-technical reader can understand the result without needing to understand the internal scoring system.

## Appeals Workflow

A creator can submit an appeal if they believe their content was misclassified.

### Who can submit an appeal?

Any creator with a valid `content_id` can submit an appeal.

### Information required

The appeal request must include:

```json
{
  "creator_id": "creator_123",
  "content_id": "generated-content-id",
  "reason": "I wrote this myself and can provide earlier drafts."
}
```

### What happens when an appeal is received?

When an appeal is received, the system will:

1. Validate that `content_id` and `reason` are present.
2. Look up the original decision by `content_id`.
3. Create a new `appeal_id`.
4. Update the content status to `"under review"`.
5. Save the appeal reason, appeal ID, original content ID, creator ID, and timestamp in the audit log.
6. Return a response confirming that the appeal was received.

### What a human reviewer would see

A human reviewer opening the appeal queue would see:

* appeal ID
* content ID
* creator ID
* original classification result
* original confidence score
* signal scores used in the original decision
* transparency label shown to the reader
* creator's appeal reason
* current status: `"under review"`
* timestamp of the appeal

Automated reclassification is not required for this version. The appeal workflow focuses on capturing the dispute clearly and preserving the original decision for review.

## Anticipated Edge Cases

### Edge case 1: Short text

Very short writing samples, such as one-line poems or captions, may not provide enough data for reliable stylometric analysis. Sentence variance and vocabulary diversity are less meaningful when the text has very few words.

Expected handling:
The system should still return a result, but the score may land closer to uncertain. If there is not enough text for a strong signal, the system should avoid overconfident labeling.

### Edge case 2: Repetitive poetry

A human-written poem may intentionally use repeated words, short lines, and simple vocabulary. The stylometric signal might mistake this for AI-like uniformity because type-token ratio may be low and sentence patterns may look repetitive.

Expected handling:
The LLM signal may provide additional context, and if the signals disagree, the combined score should fall into the uncertain range.

### Edge case 3: Highly edited AI text

AI-generated text that has been heavily edited by a human may look more varied and natural. Both the LLM and stylometric signals may classify it as human-written or uncertain.

Expected handling:
The system should not claim perfect detection. It should communicate uncertainty when evidence is weak or mixed.

### Edge case 4: Polished professional human writing

A well-edited human blog post may have clean sentence structure, consistent tone, and smooth transitions. The LLM may misread this polish as AI-generated.

Expected handling:
The high AI threshold reduces the chance of immediately labeling the content as AI-generated. If the score is not clearly high, the content should be labeled uncertain.

## AI Tool Plan

This section defines how I will use AI assistance during implementation while keeping the design decisions grounded in this spec.

### M3: Submission Endpoint and First Signal

Spec sections to provide to the AI tool:

* Architecture
* Detection Signals
* API Surface
* Confidence Scoring and Uncertainty Representation

What I will ask it to generate:

* Flask app skeleton
* `POST /submit` endpoint
* request validation for `creator_id` and `text`
* first detection signal function
* basic structured response shape

Verification plan:

* Test the first signal directly with sample text before connecting it to the endpoint.
* Send a valid `POST /submit` request and confirm the response includes `content_id`, `result`, `confidence`, `ai_score`, `signals`, and `transparency_label`.
* Send a request missing `text` and confirm the API returns a clear error.

### M4: Second Signal and Confidence Scoring

Spec sections to provide to the AI tool:

* Detection Signals
* Confidence Scoring and Uncertainty Representation
* Architecture
* Anticipated Edge Cases

What I will ask it to generate:

* stylometric heuristic signal function
* normalized feature scoring
* equal-weight confidence scoring logic
* threshold-based result mapping

Verification plan:

* Test clearly human-written text.
* Test clearly AI-like text.
* Test ambiguous or short text.
* Confirm that scores vary meaningfully instead of always returning the same value.
* Confirm that disagreement between signals produces an uncertain result.

### M5: Production Layer

Spec sections to provide to the AI tool:

* Transparency Label Design
* Appeals Workflow
* Architecture
* API Surface

What I will ask it to generate:

* transparency label generation logic
* SQLite audit log tables
* audit logging for attribution decisions
* `POST /appeal` endpoint
* `GET /log` endpoint
* Flask-Limiter rate limiting on `POST /submit`

Verification plan:

* Confirm all three label variants are reachable by testing different score ranges.
* Confirm every `/submit` request writes a decision to the audit log.
* Confirm `/appeal` updates status to `"under review"`.
* Confirm `/log` shows attribution decisions and appeal events.
* Confirm rate limiting blocks excessive requests.
