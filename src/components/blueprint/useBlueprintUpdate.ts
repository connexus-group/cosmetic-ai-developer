import { useState } from 'react';
import { BLUEPRINT_FIELDS } from '@/data/blueprintFields';
import { SPEC_FIELDS } from '@/data/intakeSpec';
import type { Blueprint, Spec, SpecFieldId } from '@/data/types';
import { blueprintToSpec, refreshEntries } from '@/lib/blueprint';
import { moqFrom, parseWon, specToAnswers } from '@/lib/spec';
import { useProject } from '@/pages/project/ProjectLayout';

/**
 * Editing the confirmed AI Product Blueprint inside a project (Overview and the analysis steps).
 * Changed items flow into the spec every later step reads.
 */
export function useBlueprintUpdate() {
  const { project: p, update, touch } = useProject();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  const updateBlueprint = (next: (cur: Blueprint) => Blueprint) =>
    update((x) => {
      if (!x.blueprint) return x;
      const bp = next(x.blueprint);
      const changedKeys = BLUEPRINT_FIELDS.filter((f) => x.blueprint!.entries[f.key]?.value !== bp.entries[f.key]?.value || x.blueprint!.entries[f.key]?.origin !== bp.entries[f.key]?.origin).map((f) => f.key);
      if (!changedKeys.length) return { ...x, blueprint: bp };
      const mapped = blueprintToSpec(bp);
      const ids = new Set<SpecFieldId>(BLUEPRINT_FIELDS.filter((f) => f.spec && changedKeys.includes(f.key)).map((f) => f.spec!));
      if (changedKeys.includes('lowIrritation')) ids.add('lowIrritation');
      if (changedKeys.some((k) => k === 'hero' || k === 'actives')) ids.add('mustInclude');
      if (changedKeys.includes('markets')) ids.add('overseasReview');
      const nextSpec: Spec = { ...x.spec };
      const answers = { ...x.answers };
      for (const id of ids) {
        if (mapped[id]) nextSpec[id] = mapped[id];
        else delete nextSpec[id];
        const legacy = SPEC_FIELDS.find((f) => f.id === id)?.legacy;
        if (legacy) {
          const m = mapped[id] ? specToAnswers({ [id]: mapped[id] })[legacy] : undefined;
          if (m) answers[legacy] = m;
          else delete answers[legacy];
        }
      }
      const price = ids.has('targetPrice') && nextSpec.targetPrice?.mode !== 'unknown' ? parseWon(nextSpec.targetPrice?.value[0]) : null;
      return { ...x, blueprint: bp, spec: nextSpec, answers, retailPrice: price && price > 1000 ? price : x.retailPrice, moq: ids.has('firstRun') ? (moqFrom(nextSpec) ?? x.moq) : x.moq, changed: touch('intake') };
    });

  const refresh = async (keys: string[]) => {
    if (!p.blueprint) return;
    setBusy(new Set(keys));
    const { bp, error, keys: changed } = await refreshEntries(p.blueprint, keys);
    updateBlueprint((cur) => ({ ...cur, entries: { ...cur.entries, ...Object.fromEntries(changed.filter((k) => !cur.entries[k]?.locked).map((k) => [k, bp.entries[k]])) }, regulatory: bp.regulatory }));
    setBusy(new Set());
    setNote(error ?? null);
  };

  return { updateBlueprint, refresh, busy, note };
}
