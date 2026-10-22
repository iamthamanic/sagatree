/**
 * Internal base-body morph fixture panel — no end-user navigation.
 * Location: src/app/character/avatar/BaseBodyMorphFixture.tsx
 *
 * Lets authors cycle #213 fixture cases (single / extreme morphs) and shows
 * capability readiness from present morph-target evidence.
 * Collapsed by default so it does not dominate the Character Editor sidebar.
 */
import { useEffect, useState } from 'react';
import {
  CaretDown,
  CaretRight
} from '@phosphor-icons/react';
import {
  BASE_BODY_CAMERA_SAFE_BOUNDS,
  assertMorphFixtureCameraSafe,
  buildBaseBodyMorphFixtureCases,
  createSagaTreeBaseBodyManifestV1,
  deriveSpeciesMorphState,
  type BaseBodySpeciesId,
} from '../../../domains/character/avatar/base-body-contract';
import {
  evaluateBaseBodyMorphReadiness,
  simulateCompleteMorphTargetEvidence,
} from '../../../infrastructure/character/avatar/base-body-catalog';

const SPECIES: readonly BaseBodySpeciesId[] = [
  'human',
  'elf',
  'dwarf',
  'halfling',
  'orc',
  'cyborg',
  'alien',
];

export function BaseBodyMorphFixture() {
  const cases = buildBaseBodyMorphFixtureCases();
  const [open, setOpen] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [speciesId, setSpeciesId] = useState<BaseBodySpeciesId>('human');
  const [presentTargets, setPresentTargets] = useState<readonly string[]>([]);

  useEffect(() => {
    // Fixture default: incomplete mesh (fail closed). Toggle below simulates authored mesh.
    setPresentTargets([]);
  }, []);

  const current = cases[caseIndex] ?? cases[0];
  const camera = assertMorphFixtureCameraSafe(current.morph);
  const readiness = evaluateBaseBodyMorphReadiness(presentTargets);
  const manifest = createSagaTreeBaseBodyManifestV1();
  const speciesMorph = deriveSpeciesMorphState(speciesId);

  return (
    <section
      className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-200/40 p-4 text-sm"
      data-testid="base-body-morph-fixture"
      data-fixture-open={open ? 'true' : 'false'}
      aria-label="Interne Base-Body Morph Fixture"
    >
      <header>
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          data-testid="base-body-fixture-toggle"
          aria-expanded={open}
          aria-controls="base-body-fixture-panel"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="mt-0.5 shrink-0 text-base-content/70" aria-hidden>
            {open ? <CaretDown className="h-4 w-4" /> : <CaretRight className="h-4 w-4" />}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold">Base-Body Morph Fixture</span>
            <span className="text-base-content/70">
              Interner Test für Morph-Extremwerte. Keine Enduser-Steuerung.
              {!open ? ' · eingeklappt' : ''}
            </span>
          </span>
        </button>
      </header>

      {open ? (
        <div id="base-body-fixture-panel" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm"
              data-testid="base-body-fixture-prev"
              onClick={() => setCaseIndex((index) => (index - 1 + cases.length) % cases.length)}
            >
              Vorheriger Morph
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              data-testid="base-body-fixture-next"
              onClick={() => setCaseIndex((index) => (index + 1) % cases.length)}
            >
              Nächster Morph
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              data-testid="base-body-fixture-simulate-complete"
              onClick={() => setPresentTargets(simulateCompleteMorphTargetEvidence())}
            >
              Morph-Targets vollständig simulieren
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              data-testid="base-body-fixture-clear-targets"
              onClick={() => setPresentTargets([])}
            >
              Targets leeren
            </button>
          </div>

          <p data-testid="base-body-fixture-case">
            Fall {caseIndex + 1}/{cases.length}: {current.labelDe}
          </p>

          <label className="form-control w-full max-w-xs">
            <span className="label-text">Species-Preset anwenden (explizit)</span>
            <select
              className="select select-bordered select-sm"
              data-testid="base-body-fixture-species"
              value={speciesId}
              onChange={(event) => setSpeciesId(event.target.value as BaseBodySpeciesId)}
            >
              {SPECIES.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div>
              <dt className="opacity-70">Asset</dt>
              <dd data-testid="base-body-fixture-asset">{manifest.assetVersion}</dd>
            </div>
            <div>
              <dt className="opacity-70">Morph-Vertrag</dt>
              <dd>{manifest.morphContractVersion}</dd>
            </div>
            <div>
              <dt className="opacity-70">Orbit min/max</dt>
              <dd>
                {camera.minOrbitDistance}–{camera.maxOrbitDistance}
              </dd>
            </div>
            <div>
              <dt className="opacity-70">Portrait FOV</dt>
              <dd>{BASE_BODY_CAMERA_SAFE_BOUNDS.portraitFovDeg}°</dd>
            </div>
          </dl>

          <p data-testid="base-body-fixture-capabilities">
            Capabilities:{' '}
            {readiness.flags.length > 0 ? readiness.flags.join(', ') : 'keine (fehlende Targets)'}
          </p>
          {readiness.limitations.length > 0 ? (
            <ul className="list-disc pl-5 text-warning" data-testid="base-body-fixture-limitations">
              {readiness.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <pre
            className="max-h-48 overflow-auto rounded bg-base-300 p-2 text-xs"
            data-testid="base-body-fixture-morph-json"
          >
            {JSON.stringify(
              {
                caseMorph: current.morph.body,
                speciesHeight: speciesMorph.body.height,
                speciesBuild: speciesMorph.body.build,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
