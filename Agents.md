# Agents.md – Guidance for the SimpleSheet LLM Agent

## 1. Overview
The **SimpleSheet LLM Agent** is an autonomous language‑model worker that will turn the design specification into a fully functional web‑app.  
Its job is to:

* Consume the **prompt templates** (see `promptTemplates.json` in the repository).  
* Generate the required artifacts (code files, docs, tests, configs).  
* Verify that each artifact meets its **acceptance criteria**.  
* Update the task status in the master task list.  

All work must be performed **non‑autogressively** – each task is a self‑contained unit that produces a single, well‑defined output.

---

## 2. Core Responsibilities
| Responsibility | How to Achieve It |
|----------------|-------------------|
| **Task Execution** | For a given `taskId`, copy the associated `prompt` and run it through the LLM. Return the generated output exactly as a fenced code block (file name as language label). |
| **Validation** | After generation, programmatically (or manually) check the **acceptance** condition (e.g., compile‑time errors, test pass, UI behavior). |
| **Status Update** | When a task passes, emit a JSON snippet (see *Status Update Format* below) that marks the task as `done` and includes a reference to the artifact. |
| **Dependency Management** | Only start a task when **all** `dependencies` listed in the task definition have status `done`. |
| **Error Handling** | If a generated artifact fails validation, return a JSON snippet with `status: "error"` and a short `message`. The orchestrator can then request a retry. |
| **Documentation** | Keep the `Agents.md` file up‑to‑date with any new conventions or workflow changes. |

---

## 3. Workflow

1. **Initialize** – Load `tasks.json` (the master task list) and `promptTemplates.json`.  
2. **Select Next Task** – Scan for the first task whose `status` is `todo` **and** whose `dependencies` are all `done`.  
3. **Run Prompt** – Retrieve the matching prompt from `promptTemplates.json` and send it to the LLM.  
4. **Receive Output** – The LLM returns the requested artifact(s) in fenced code blocks.  
5. **Validate** – Run the appropriate build / test / UI check.  
6. **Report** – Emit a **status update** JSON (see below).  
7. **Loop** – Return to step 2 until all tasks are `done` or an unrecoverable error occurs.

---

## 4. Status Update Format

```json
{
  "taskId": "task-2-1",
  "status": "done",
  "artifact": [
    {
      "path": "src/components/Grid.tsx",
      "type": "code",
      "content": "<code block>"
    },
    {
      "path": "src/App.tsx",
      "type": "code",
      "content": "<code block>"
    }
  ],
  "notes": "Smooth scrolling verified on 10 k rows."
}


### 5. Prompt Template Usage

Each entry in promptTemplates.json contains:
* taskId – matches a task in the master list.
* prompt – the exact instruction to give the LLM.
* outputFormat – the expected artifact(s) (file name, type).
* acceptance – the criteria the agent must verify before marking the task done.

The agent must not modify the prompt text; it should be passed verbatim to the LLM.
If a prompt requests multiple files, the LLM should return separate fenced code blocks labelled with the filename (e.g., ts src/components/Grid.tsx).

### 6. Validation Checklist

Artifact Type	Validation Method
TypeScript / JSX	Run npm run lint && npm run build. No TypeScript errors, no lint warnings.
Jest Tests	Execute npm test. All tests pass, coverage ≥ 80 % for the targeted files.
Cypress E2E	Run npm run cypress. No failures; screenshots saved on error.
UI Components	Manually open npm run dev and verify the described behavior (e.g., merging cells works, freeze panes stay visible).
Import/Export	Load a sample file, export it back, and compare content (binary diff for XLSX, string diff for CSV/JSON).
PDF	Open generated PDF, confirm layout matches on‑screen preview.
Performance Benchmark	Run the benchmark script; ensure FPS ≥ 55 and export latency ≤ 2 s.
If a validation step fails, the agent should emit an "error" status with a concise message and re‑run the prompt after any necessary clarification.

### 7. Communication Protocol

The agent only communicates via JSON status updates and, when asked, returns the generated code blocks.
No extraneous prose should be added to the status update JSON.
The only free‑form text the agent may emit is a single short follow‑up question (as required by the overall system policy) after a batch of status updates, e.g., “Do you want to prioritize column resizing before freeze panes?”

### 8. Example Interaction

User → Agent: "Please start with task‑2‑1." Agent → LLM (prompt from promptTemplates.json): "Implement a virtualized grid component …" Agent → LLM returns code blocks. Agent → Validation (npm run build) succeeds. Agent → Sends status update JSON (see Section 4).

### 9. Extending the Agent

To add new tasks, append them to tasks.json and create a matching entry in promptTemplates.json.
Update the dependency graph accordingly.
The agent will automatically consider the new tasks in its next iteration.
