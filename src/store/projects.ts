/**
 * Local index of research projects, persisted on the device.
 *
 * Agent Memory is the source of truth for what the agent knows; this store
 * only remembers which projects exist, the notes as typed (so the list renders
 * offline), and the last report.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Citation, Extracted } from "@/memory/memory";

export interface Note {
	id: string;
	text: string;
	createdAt: string;
	status: "saving" | "stored" | "failed";
	error?: string;
	extracted?: Extracted;
}

export interface Finding {
	question: string;
	answer: string;
}

export interface Report {
	markdown: string;
	citations: Citation[];
	findings: Finding[];
	createdAt: string;
}

export interface Project {
	id: string;
	topic: string;
	sessionId?: string;
	createdAt: string;
	notes: Note[];
	report?: Report;
}

interface ProjectsState {
	projects: Project[];
	createProject(topic: string): Project;
	deleteProject(id: string): void;
	setSession(id: string, sessionId: string): void;
	addNote(projectId: string, text: string): Note;
	updateNote(projectId: string, noteId: string, patch: Partial<Note>): void;
	removeNote(projectId: string, noteId: string): void;
	setReport(projectId: string, report: Report): void;
}

const now = () => new Date().toISOString();

export const useProjects = create<ProjectsState>()(
	persist(
		(set) => {
			const patchProject = (id: string, fn: (p: Project) => Project) =>
				set((s) => ({ projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }));

			return {
				projects: [],
				createProject(topic) {
					// Short ids keep scope paths (`project/<id>`) readable.
					const project: Project = { id: randomUUID().slice(0, 8), topic, createdAt: now(), notes: [] };
					set((s) => ({ projects: [project, ...s.projects] }));
					return project;
				},
				deleteProject(id) {
					set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
				},
				setSession(id, sessionId) {
					patchProject(id, (p) => ({ ...p, sessionId }));
				},
				addNote(projectId, text) {
					const note: Note = { id: randomUUID(), text, createdAt: now(), status: "saving" };
					patchProject(projectId, (p) => ({ ...p, notes: [note, ...p.notes] }));
					return note;
				},
				updateNote(projectId, noteId, patch) {
					patchProject(projectId, (p) => ({
						...p,
						notes: p.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
					}));
				},
				removeNote(projectId, noteId) {
					patchProject(projectId, (p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) }));
				},
				setReport(projectId, report) {
					patchProject(projectId, (p) => ({ ...p, report }));
				},
			};
		},
		{
			name: "research-agent/projects",
			version: 1,
			storage: createJSONStorage(() => AsyncStorage),
			// A note still "saving" when the app closed never got confirmed.
			merge: (persisted, current) => {
				const projects = ((persisted as Partial<ProjectsState>)?.projects ?? []).map((p) => ({
					...p,
					notes: p.notes.map((n) =>
						n.status === "saving" ? { ...n, status: "failed" as const, error: "Interrupted" } : n,
					),
				}));
				return { ...current, projects };
			},
		},
	),
);

export function useProject(id: string | undefined): Project | undefined {
	return useProjects((s) => s.projects.find((p) => p.id === id));
}
