# Polycracker: Official n8n Client for the Polycracker Platform

This package provides the official **Workflow API** integration for the Polycracker AI Orchestration Platform. By installing these nodes, you are connecting your n8n workflows directly to the **Polycracker infrastructure**—a production-grade backend built to eliminate "workflow spaghetti" and enable stateful, multi-step AI execution.

---

## 🚀 The Polycracker Ecosystem
Polycracker is a unified AI orchestration ecosystem designed to power enterprise-grade sequences. Your n8n nodes act as the **Orchestration Client** for our platform, bridging your local canvas with our high-performance backend:

*   **Workflow API:** Stateful, multi-step orchestration. Use our suite of nodes to plan and execute complex sequences that persist state across your n8n canvas.
*   **Universal API:** High-performance, model-agnostic LLM execution. Access top-tier intelligence with built-in structured output.
*   **Memory API:** Production-grade RAG. A tenant-isolated engine that injects long-term context into your AI, curing model amnesia.

---

## 📦 Node Suite: The Workflow API Plane
The following nodes comprise the core orchestration suite, enabling seamless state management and intelligent execution directly within your n8n workflows:

| Node | Purpose | API Pillar |
| :--- | :--- | :--- |
| **Parrot Integration** | The Handshake. Initializes and plans complex, multi-step orchestration sequences. | Workflow API |
| **Parrot Smart** | The Executor. Executes intelligent logic steps and manages session-bound AI state. | Workflow API |
| **Parrot Gate** | The Filter. Applies privacy-first schema healing and data scrubbing before processing. | Workflow API |

---

## ⚙️ Quick Start

1.  **Install:** `npm install n8n-nodes-polycracker`
2.  **Authenticate:** Sign up at [www.polycracker.dev](https://www.polycracker.dev), then generate your API key. Create a new **ParrotApi** credential in n8n and input your key.
3.  **Orchestrate:** Start your sequence with **Parrot Integration** to generate your `sequence_jwt`, then pass it through **Parrot Smart** to execute your logic steps.

---

## 💰 Billing & Transparency
Usage is billed via your Gateway balance:

| Operation | Default Cost | Marker |
| :--- | :--- | :--- |
| **Handshake** | $0.01 | Integration Request |
| **Smart-Hit (Guided)** | $0.05 | Sequence Step |
| **Smart-Hit (Chameleon)** | $0.20 | Sequence Step |

---

## 🌌 Beyond the Canvas: The Core Pillars
While our nodes represent the **Workflow API**, you can leverage the full platform power directly via HTTP requests for advanced use cases:

### 🧠 Universal API (Stateless Intelligence)
Access the same high-performance LLM routing used by our "Chameleon" tier without n8n sequence machinery.
*   **Best for:** Real-time structured JSON extraction and model-agnostic execution.
*   **Implementation:** `POST /api/v1/universal/execute`

### 💾 Memory API (Production-Grade RAG)
Our purpose-built, tenant-isolated vector store cures LLM amnesia.
*   **Best for:** Retrieval-Augmented Generation (RAG) and domain-specific knowledge management.
*   **Implementation:** Utilize `/ingest` and `/recall` endpoints via the HTTP Request node.

---

## 🛠 Advanced Integration
Because these nodes manage complex session state (JWT baton-passing) for you, they are the fastest way to build. However, for specialized needs:
*   **Going Stateless?** Use the Universal API directly for single-shot, model-agnostic execution.
*   **Need Memory?** Use the Memory API to anchor your workflows in your own proprietary data.

---

## 🛡 Support & License
*   **Support:** For issues or feature requests, visit the Polycracker main page at [www.polycracker.dev](https://www.polycracker.dev) or contact our team at `access@polycracker.dev`.
*   **License:** Copyright © 2026 Parrot Integrated Software Development. All rights reserved.
*   **Terms:** This software is a proprietary component of the Polycracker platform, developed by Parrot Integrated Software Development. Unauthorized distribution or reproduction is prohibited.

*Engineered by the Polycracker Fleet. Orchestrating the future of AI automation.*
