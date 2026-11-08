/**
 * avatar-3d-generation shared — Deno unit tests for settings map + validation.
 * Location: supabase/functions/_shared/avatar-3d-generation_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  DEFAULT_RECOMMENDED_SETTINGS,
  mapSettingsToMeshyImageTo3d,
  validateGenerationSettings,
} from './avatar-3d-generation.ts';

Deno.test('recommended settings map to 4k texture, no initial remesh, a-pose, pbr', () => {
  const mapped = mapSettingsToMeshyImageTo3d(DEFAULT_RECOMMENDED_SETTINGS);
  assertEquals(mapped.texture_resolution, '4k');
  assertEquals(mapped.should_remesh, false);
  assertEquals(mapped.pose_mode, 'a-pose');
  assertEquals(mapped.enable_pbr, true);
  assertEquals(mapped.model_type, 'standard');
  assertEquals(mapped.image_enhancement, false);
});

Deno.test('smart-topology forces meshy-t2 and polycount cap', () => {
  const mapped = mapSettingsToMeshyImageTo3d({
    ...DEFAULT_RECOMMENDED_SETTINGS,
    geometryQuality: 'smart-topology',
    modelId: 'latest',
    targetPolycount: 8_000,
    initialRemesh: true,
  });
  assertEquals(mapped.model_type, 'smart-topology');
  assertEquals(mapped.ai_model, 'meshy-t2');
  assertEquals(mapped.should_remesh, false);
  assertEquals(mapped.target_polycount, 8_000);
});

Deno.test('validateGenerationSettings rejects unknown modelId', () => {
  const result = validateGenerationSettings({
    ...DEFAULT_RECOMMENDED_SETTINGS,
    modelId: 'meshy-evil',
  });
  assertEquals(result.ok, false);
});

Deno.test('ultra_mode ignored unless geometryQuality is maximum', () => {
  const mapped = mapSettingsToMeshyImageTo3d({
    ...DEFAULT_RECOMMENDED_SETTINGS,
    geometryQuality: 'high',
    providerExtras: { ultra_mode: true },
  });
  assertEquals(mapped.ultra_mode, false);
});

Deno.test('validateGenerationSettings rejects unknown geometry', () => {
  const result = validateGenerationSettings({
    ...DEFAULT_RECOMMENDED_SETTINGS,
    geometryQuality: 'ultra-mega',
  });
  assertEquals(result.ok, false);
});

Deno.test('validateGenerationSettings accepts recommended bag', () => {
  const result = validateGenerationSettings(DEFAULT_RECOMMENDED_SETTINGS);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.settings.textureQuality, '4k');
  }
});
