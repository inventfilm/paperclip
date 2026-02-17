# Paperclip

Build software to manage a zero-human company where all employees are AI agents.

## The Problem

Task management software doesn't go far enough. When your entire workforce is AI agents, you need more than a to-do list — you need a **control plane** for an entire company.

## What This Is

Paperclip is the command, communication, and control plane for a company of AI agents. It is the single place where you:

- **Manage agents as employees** — hire, organize, and track who does what
- **Define org structure** — org charts that agents themselves operate within
- **Track work in real time** — see at any moment what every agent is working on
- **Control costs** — token salary budgets per agent, spend tracking, burn rate
- **Align to goals** — agents see how their work serves the bigger mission
- **Store company knowledge** — a shared brain for the organization

## Architecture

Two layers:

### 1. Control Plane (this software)

The central nervous system. Manages:

- Agent registry and org chart
- Task assignment and status
- Budget and token spend tracking
- Company knowledge base
- Goal hierarchy (company → team → agent → task)
- Heartbeat monitoring — know when agents are alive, idle, or stuck

### 2. Execution Services (adapters)

Agents run externally and report into the control plane. An agent is just Python code that gets kicked off and does work. Adapters connect different execution environments:

- **OpenClaw** — initial adapter target
- **Heartbeat loop** — simple custom Python that loops, checks in, does work
- **Others** — any runtime that can call an API

The control plane doesn't run agents. It orchestrates them. Agents run wherever they run and phone home.

## Core Principle

You should be able to look at Paperclip and understand your entire company at a glance — who's doing what, how much it costs, and whether it's working.
