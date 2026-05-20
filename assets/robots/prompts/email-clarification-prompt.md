# Email Clarification Prompt

Use this prompt when drafting a professional email to an architect, engineer, owner, project manager, or design team member asking for estimating clarification.

This prompt is intended for short, direct, construction-estimating coordination emails.

Use with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../tools/estimate-review-checklist.md`
- `../tools/document-comparison-checklist.md`

---

## Copy/Paste Prompt

```text
You are helping me draft a professional construction estimating clarification email.

The email should be concise, direct, and easy for the recipient to answer. It should sound like it is coming from a construction estimator, not a generic AI assistant.

Project information:

- Project name: [INSERT PROJECT NAME]
- Recipient name: [INSERT RECIPIENT NAME]
- Recipient role/company: [INSERT ROLE / COMPANY]
- Reason for email: [INSERT REASON]
- Deadline or schedule concern: [INSERT DEADLINE IF APPLICABLE]
- Tone: [Direct / Friendly / Formal / Brief]

Context:

[PASTE CONTEXT, EMAIL THREAD, ESTIMATE ISSUE, DOCUMENT QUESTION, OR DESIGN COMMENT HERE]

Questions or clarification items:

1. [INSERT QUESTION 1]
2. [INSERT QUESTION 2]
3. [INSERT QUESTION 3]

Draft an email that:

1. Acknowledges the project or prior message.
2. Briefly explains why the clarification is needed for the estimate.
3. Lists the questions clearly.
4. Avoids sounding accusatory.
5. Avoids overexplaining.
6. Keeps the email short enough to send without heavy editing.
7. Includes a practical closing.
8. Does not include unnecessary construction jargon unless it helps precision.

If there are multiple questions, format them as a short numbered list.

If the issue affects pricing, mention that the clarification is needed to avoid carrying the wrong assumption or duplicating scope.

If a budgetary assumption should be included, add a sentence such as:

If we do not hear otherwise, we will carry [INSERT ASSUMPTION] for this estimate.

Output only the email draft unless I ask for notes or alternatives.
```

---

## Short Clarification Email Prompt

Use this version for quick email replies.

```text
Draft a short, professional estimating clarification email based on the following issue.

Keep it concise and easy to answer. Include only the necessary context, the clarification question, and a practical closing.

Project: [INSERT PROJECT]
Recipient: [INSERT RECIPIENT]
Issue: [INSERT ISSUE]
Question: [INSERT QUESTION]
Assumption if unanswered: [INSERT ASSUMPTION, OR WRITE NONE]
Tone: [INSERT TONE]

Output only the email draft.
```

---

## Email Style Rules

Use this style:

- Clear subject line when requested.
- Short opening.
- Direct question or numbered questions.
- Brief reason the question matters.
- No long background unless necessary.
- Professional but not stiff.
- No blame language.
- No exaggerated urgency unless the schedule requires it.

Avoid:

- Overly formal legal tone.
- Long paragraphs.
- Saying the documents are wrong unless necessary.
- Making the recipient hunt for the actual question.
- Too many qualifiers.

---

## Common Estimating Clarification Topics

This prompt works well for questions about:

- Scope included vs excluded
- Base bid vs alternate scope
- Owner-furnished vs contractor-furnished items
- Quantity conflicts
- Drawing/specification conflicts
- Equipment selections
- Controls / SCADA requirements
- Phasing
- Demolition requirements
- Temporary work
- Testing and commissioning
- General Requirements assumptions
- Freight or delivery assumptions
- Material substitutions
- VE item scope
- Schedule assumptions

---

## Example Output Structure

```text
Subject: [Project Name] – Estimate Clarification

Hi [Name],

I am reviewing the estimate for [Project Name] and wanted to confirm one item before carrying the pricing forward.

[Brief issue statement.]

Can you confirm whether [clear question]?

If we do not hear otherwise, we will assume [budgetary assumption] for this estimate.

Thanks,
[Name]
```

---

## Numbered Question Structure

Use this when there are multiple items.

```text
Subject: [Project Name] – Estimate Clarifications

Hi [Name],

I am reviewing the estimate for [Project Name] and had a few clarification items before finalizing the pricing:

1. [Question 1]
2. [Question 2]
3. [Question 3]

If we do not hear otherwise, we will carry the assumptions noted above for this estimate.

Thanks,
[Name]
```

---

## Use Notes

Use this prompt when an estimating issue needs to be turned into a clear email.

For internal estimate notes, use a clarification table instead of an email.
