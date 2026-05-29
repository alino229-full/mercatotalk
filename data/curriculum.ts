import { lessonDetails, type LessonDetail } from '@/data/lessons';
import { phases, type LearningPhase } from '@/data/italpro';

// ─────────────────────────────────────────────────────────────────────────────
//  Curriculum
//  Regroupe les leçons par chapitre (phase) et construit un parcours linéaire
//  "à la Duolingo": chaque chapitre = ses leçons ordonnées + un checkpoint final.
//  Le parcours à plat sert au déblocage progressif et à la reprise (resume).
// ─────────────────────────────────────────────────────────────────────────────

export type GateKind = 'lesson' | 'checkpoint';

export type LessonNode = {
  kind: 'lesson';
  id: string;
  chapterId: string;
  title: string;
  icon: string;
  lesson: LessonDetail;
  /** index global dans le parcours à plat */
  gateIndex: number;
  /** index local dans le chapitre (0-based) */
  indexInChapter: number;
};

export type CheckpointNode = {
  kind: 'checkpoint';
  id: string;
  chapterId: string;
  title: string;
  gateIndex: number;
};

export type PathNode = LessonNode | CheckpointNode;

export type Chapter = {
  id: string;
  number: number;
  title: string;
  goal: string;
  weeks: string;
  accentColor: string;
  lessons: LessonNode[];
  checkpoint: CheckpointNode;
  /** tous les nœuds du chapitre dans l'ordre (leçons puis checkpoint) */
  nodes: PathNode[];
};

export const checkpointId = (chapterId: string) => `checkpoint-${chapterId}`;

function buildCurriculum() {
  const chapters: Chapter[] = [];
  const flat: PathNode[] = [];
  let gateIndex = 0;
  let chapterNumber = 0;

  for (const phase of phases as LearningPhase[]) {
    const phaseLessons = lessonDetails.filter((l) => l.phaseId === phase.id);
    if (phaseLessons.length === 0) continue;

    chapterNumber += 1;
    const accent = phase.accentColor ?? '#58CC02';

    const lessonNodes: LessonNode[] = phaseLessons.map((lesson, i) => {
      const node: LessonNode = {
        kind: 'lesson',
        id: lesson.id,
        chapterId: phase.id,
        title: lesson.title,
        icon: lesson.icon,
        lesson,
        gateIndex: gateIndex++,
        indexInChapter: i,
      };
      flat.push(node);
      return node;
    });

    const checkpoint: CheckpointNode = {
      kind: 'checkpoint',
      id: checkpointId(phase.id),
      chapterId: phase.id,
      title: `Checkpoint · ${phase.title}`,
      gateIndex: gateIndex++,
    };
    flat.push(checkpoint);

    chapters.push({
      id: phase.id,
      number: chapterNumber,
      title: phase.title,
      goal: phase.goal,
      weeks: phase.weeks,
      accentColor: accent,
      lessons: lessonNodes,
      checkpoint,
      nodes: [...lessonNodes, checkpoint],
    });
  }

  return { chapters, flat };
}

const built = buildCurriculum();

/** Chapitres ordonnés, chacun avec ses leçons et son checkpoint. */
export const chapters: Chapter[] = built.chapters;

/** Parcours à plat (leçons + checkpoints) dans l'ordre de progression. */
export const flatPath: PathNode[] = built.flat;

/** Tous les identifiants de "gates" à semer en base (leçons + checkpoints). */
export const allGateIds: string[] = built.flat.map((n) => n.id);

const nodeIndexById = new Map(built.flat.map((n, i) => [n.id, i]));

export function getNodeById(id: string): PathNode | undefined {
  const idx = nodeIndexById.get(id);
  return idx == null ? undefined : built.flat[idx];
}

export function getChapterById(id: string): Chapter | undefined {
  return built.chapters.find((c) => c.id === id);
}

/** L'id du gate suivant dans le parcours (ou null si dernier). */
export function nextGateId(id: string): string | null {
  const idx = nodeIndexById.get(id);
  if (idx == null) return null;
  return built.flat[idx + 1]?.id ?? null;
}

export type NodeState = 'completed' | 'current' | 'locked';

/**
 * Calcule l'état de chaque nœud à partir de l'ensemble des gates complétés.
 * Modèle linéaire: tout ce qui précède la frontière est complété, la frontière
 * est "current" (la leçon à reprendre), le reste est verrouillé.
 */
export function computePathState(completed: Set<string>): {
  states: Map<string, NodeState>;
  resumeId: string | null;
} {
  const states = new Map<string, NodeState>();
  let resumeId: string | null = null;

  for (const node of built.flat) {
    if (completed.has(node.id)) {
      states.set(node.id, 'completed');
    } else if (resumeId == null) {
      states.set(node.id, 'current');
      resumeId = node.id;
    } else {
      states.set(node.id, 'locked');
    }
  }

  return { states, resumeId };
}
