import assert from 'node:assert/strict';
import { fixture as f, asActor, setActor } from './fixtures.mjs';

async function adminQuery(cluster, text, values = []) {
  const client = await cluster.client();
  try { return await client.query(text, values); } finally { await client.end(); }
}
async function state(cluster, sessionId = f.session) {
  return (await adminQuery(cluster, `SELECT runtime_revision::integer AS revision, world_state,
    (SELECT count(*)::integer FROM public.session_events WHERE session_id=$1) AS events
    FROM public.sessions WHERE id=$1`, [sessionId])).rows[0];
}
async function rpc(cluster, actor, name, values, signature) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid fixture RPC identifier');
  return asActor(cluster, actor, async (client) =>
    (await client.query(`SELECT public.${name}(${signature}) AS value`, values)).rows[0].value);
}
const command = (cluster, actor, revision, key, { session = f.session, kind = 'presence', payload = { isOnline: true } } = {}) =>
  rpc(cluster, actor, 'apply_session_runtime_command', [session, revision, kind, payload, key], '$1::uuid,$2::bigint,$3::text,$4::jsonb,$5::text');
const denial = (work, codes = ['42501']) => assert.rejects(work, (error) => codes.includes(error.code));

export async function runProbes(cluster, report, { canaryOnly = false, injectPolicyRegression = false } = {}) {
  report.tests = [];
  async function probe(id, name, work, severity = 'Medium') {
    if (canaryOnly && id !== 'PAR-10') return;
    const row = { id, name, severity, status: 'running' };
    report.tests.push(row);
    const started = performance.now();
    try { row.details = await work() ?? null; row.status = 'passed'; }
    catch (error) {
      row.status = 'failed'; row.error = error.message; row.errorCode = error.code ?? null;
      row.sqlstate = /^[0-9A-Z]{5}$/.test(error.code ?? '') ? error.code : null;
    }
    row.durationMs = Math.round(performance.now() - started);
    console.log(`${row.status === 'passed' ? 'PASS' : 'FAIL'} ${id}: ${name}${row.error ? ` — ${row.error}` : ''}`);
  }

  await probe('AUTH-01', 'Distinct owner and GM retain their actual permissions', async () => {
    const owner = await asActor(cluster, f.actors.owner, async (client) => (await client.query(`SELECT
      current_user AS role, auth.uid() AS actor,
      public.current_user_can_edit_world_profile($1) AS edit,
      public.is_project_gm($2,auth.uid()) AS gm`, [f.world, f.project])).rows[0]);
    const gm = await asActor(cluster, f.actors.gm, async (client) => (await client.query(`SELECT
      public.current_user_can_edit_world_profile($1) AS edit,
      public.is_project_gm($2,auth.uid()) AS gm`, [f.world, f.project])).rows[0]);
    assert.deepEqual(owner, { role: 'authenticated', actor: f.actors.owner, edit: true, gm: false });
    assert.deepEqual(gm, { edit: false, gm: true });
    await rpc(cluster, f.actors.owner, 'rename_world_node', [f.world, f.place, 'Fixture continent renamed'], '$1::uuid,$2::uuid,$3::text');
    await denial(() => rpc(cluster, f.actors.gm, 'rename_world_node', [f.world, f.place, 'Unauthorized GM edit'], '$1::uuid,$2::uuid,$3::text'));
    await denial(() => command(cluster, f.actors.owner, 0, 'owner-not-gm', { kind: 'gameplay', payload: { sceneId: 'forbidden' } }));
    return { owner, gm };
  });
  await probe('PAR-01', 'Owner sees private maps; GM sees hidden saga NPC bindings', async () => {
    const maps = await rpc(cluster, f.actors.owner, 'list_world_atlas_maps', [f.world, false, null], '$1::uuid,$2::boolean,$3::text');
    assert.deepEqual(new Set(maps.maps.map((row) => row.id)), new Set([f.rootMap, f.secretMap]));
    const bindings = await rpc(cluster, f.actors.gm, 'list_saga_bindings', [f.sagaPublicId, 'npc'], '$1::text,$2::text');
    assert(bindings.some((row) => row.id === f.secretNpcBinding));
  });
  await probe('PAR-02', 'Both players cannot fetch unrevealed map titles or hidden NPC bindings', async () => {
    for (const actor of [f.actors.player1, f.actors.player2]) {
      const maps = await rpc(cluster, actor, 'list_world_atlas_maps', [f.world, true, f.sagaPublicId], '$1::uuid,$2::boolean,$3::text');
      assert.deepEqual(maps.maps, []);
      await denial(() => rpc(cluster, actor, 'get_world_atlas_map', [f.secretMap, true, f.sagaPublicId], '$1::uuid,$2::boolean,$3::text'), ['P0002']);
      const bindings = await rpc(cluster, actor, 'list_saga_bindings', [f.sagaPublicId, 'npc'], '$1::text,$2::text');
      assert(bindings.some((row) => row.id === f.publicNpcBinding));
      assert(!bindings.some((row) => row.id === f.secretNpcBinding));
    }
  });
  await probe('PAR-03', 'Foreign owner and unauthenticated SQL context denied at real RPC', async () => {
    for (const actor of [f.actors.outsider, null]) {
      await denial(() => rpc(cluster, actor, 'list_world_atlas_maps', [f.world, false, f.sagaPublicId], '$1::uuid,$2::boolean,$3::text'));
    }
  });
  await probe('ATLAS-REVEAL', 'GM reveal enables real positive player map fetch with layer redaction', async () => {
    await rpc(cluster, f.actors.gm, 'set_saga_binding_reveal', [f.project, f.locationBinding, 'party'], '$1::uuid,$2::uuid,$3::text');
    for (const actor of [f.actors.player1, f.actors.player2]) {
      const maps = await rpc(cluster, actor, 'list_world_atlas_maps', [f.world, true, f.sagaPublicId], '$1::uuid,$2::boolean,$3::text');
      assert.deepEqual(maps.maps.map((row) => row.id), [f.rootMap]);
      const map = await rpc(cluster, actor, 'get_world_atlas_map', [f.rootMap, true, f.sagaPublicId], '$1::uuid,$2::boolean,$3::text');
      assert.equal(map.title, f.publicTitle);
      assert(!JSON.stringify(map).includes('Secret landmark'));
      assert.equal(map.layers.features.length, 1);
      assert.equal(map.azgaarMapStoragePath, null);
      const missingSaga = await rpc(cluster, actor, 'list_world_atlas_maps', [f.world, true, null], '$1::uuid,$2::boolean,$3::text');
      assert.deepEqual(missingSaga.maps, []);
    }
  });
  await probe('PAR-09', 'Inventory update affects only the authenticated player character', async () => {
    const result = await asActor(cluster, f.actors.player1, async (client) => {
      const own = await client.query("UPDATE public.characters SET inventory_v2 = '{\"schemaVersion\":2,\"instances\":[{\"id\":\"fixture-item\"}]}' WHERE id=$1 RETURNING id", [f.player1Character]);
      const other = await client.query("UPDATE public.characters SET inventory_v2 = '{}' WHERE id=$1 RETURNING id", [f.player2Character]);
      return { own: own.rowCount, other: other.rowCount };
    });
    assert.deepEqual(result, { own: 1, other: 0 });
  });
  await probe('PAR-05', 'Stale expectedRevision rolls back every state/event effect', async () => {
    const before = await state(cluster);
    await denial(() => command(cluster, f.actors.player1, before.revision - 1, 'stale-key'), ['40001']);
    assert.deepEqual(await state(cluster), before);
  });
  await probe('PAR-06', 'Idempotent replay does not append or bump; late replay returns current snapshot', async () => {
    const before = await state(cluster);
    await command(cluster, f.actors.player1, before.revision, 'duplicate-key');
    const committed = await state(cluster);
    assert.equal(committed.revision, before.revision + 1);
    assert.equal(committed.events, before.events + 1);
    const replay = await command(cluster, f.actors.player1, before.revision, 'duplicate-key');
    assert.equal(replay.idempotentReplay, true);
    assert.deepEqual(await state(cluster), committed);
    await command(cluster, f.actors.player2, committed.revision, 'later-command');
    const lateReplay = await command(cluster, f.actors.player1, before.revision, 'duplicate-key');
    assert.equal(lateReplay.revision, committed.revision + 1);
    assert.equal(lateReplay.idempotentReplay, true);
  });
  await probe('IDEMPOTENCY-SESSION', 'Identical keys in distinct sessions commit independently', async () => {
    const first = await state(cluster);
    const second = await state(cluster, f.secondSession);
    const a = await command(cluster, f.actors.player1, first.revision, 'shared-session-key');
    const b = await command(cluster, f.actors.player1, second.revision, 'shared-session-key', { session: f.secondSession });
    assert.equal(a.sessionId, f.session);
    assert.equal(b.sessionId, f.secondSession);
    assert.equal(b.idempotentReplay, false);
    assert.equal((await state(cluster, f.secondSession)).events, second.events + 1);
  });
  await probe('PAR-04', 'Concurrent GM and two players produce exactly one revision winner', async () => {
    const before = await state(cluster);
    const results = await Promise.allSettled([f.actors.gm, f.actors.player1, f.actors.player2]
      .map((actor, index) => command(cluster, actor, before.revision, `concurrent-${index}`)));
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
    for (const row of results.filter((entry) => entry.status === 'rejected')) assert.equal(row.reason.code, '40001');
    const after = await state(cluster);
    assert.equal(after.revision, before.revision + 1);
    assert.equal(after.events, before.events + 1);
  });
  await probe('ATOMIC-ROLLBACK', 'Failure during the real event insert rolls back state and revision', async () => {
    const before = await state(cluster);
    await adminQuery(cluster, `CREATE FUNCTION public.baseline_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.idempotency_key='rollback-key' THEN RAISE EXCEPTION 'baseline injected event failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER baseline_fail_event BEFORE INSERT ON public.session_events FOR EACH ROW EXECUTE FUNCTION public.baseline_fail_event()`);
    try {
      await denial(() => command(cluster, f.actors.player1, before.revision, 'rollback-key'), ['P0001']);
      assert.deepEqual(await state(cluster), before);
    } finally {
      await adminQuery(cluster, 'DROP TRIGGER baseline_fail_event ON public.session_events; DROP FUNCTION public.baseline_fail_event()');
    }
  });
  await probe('CRASH-ATOMIC', 'SIGKILL before COMMIT leaves neither event nor changed state', async () => {
    const before = await state(cluster);
    const client = await cluster.client();
    client.on('error', () => {});
    try {
      await client.query('BEGIN');
      await setActor(client, f.actors.player1);
      await client.query('SELECT public.apply_session_runtime_command($1,$2,\'presence\',\'{"isOnline":false}\',\'crash-key\')', [f.session, before.revision]);
      await cluster.crashAndRestart();
    } finally { await client.end().catch(() => {}); }
    assert.deepEqual(await state(cluster), before);
  });
  await probe('PAR-07', 'Committed runtime and RPC snapshot survive a PostgreSQL restart', async () => {
    const before = await state(cluster);
    const snapshot = await rpc(cluster, f.actors.player1, 'get_session_runtime_snapshot', [f.session], '$1::uuid');
    await cluster.restart();
    assert.deepEqual(await state(cluster), before);
    const reconnected = await rpc(cluster, f.actors.player1, 'get_session_runtime_snapshot', [f.session], '$1::uuid');
    assert.deepEqual(reconnected, snapshot);
  });
  await probe('PAR-08-DICE', 'Authoritative dice command persists across a real restart', async () => {
    const before = await state(cluster);
    await command(cluster, f.actors.player1, before.revision, 'dice-key', {
      kind: 'roll', payload: { characterId: f.player1Character, skill: 'athletics', natural: 999, total: 999, authoritative: false },
    });
    const rolled = await state(cluster);
    const roll = rolled.world_state.shared.lastRoll;
    assert.equal(roll.authoritative, true);
    assert(roll.natural >= 1 && roll.natural <= 20);
    assert.notEqual(roll.total, 999);
    await cluster.restart();
    assert.deepEqual(await state(cluster), rolled);
  });
  await probe('PAR-08-COMBAT', 'Authoritative combat start and next-turn persist across a real restart', async () => {
    const rolled = await state(cluster);
    await command(cluster, f.actors.gm, rolled.revision, 'combat-start', {
      kind: 'combat', payload: { action: 'start', participants: [
        { kind: 'pc', refId: f.player1Character }, { kind: 'pc', refId: f.player2Character },
      ] },
    });
    const combat = await state(cluster);
    assert.equal(combat.world_state.shared.encounter.status, 'active');
    assert.equal(combat.world_state.shared.encounter.participants.length, 2);
    await command(cluster, f.actors.gm, combat.revision, 'combat-next', { kind: 'combat', payload: { action: 'nextTurn' } });
    const committed = await state(cluster);
    assert.equal(committed.world_state.shared.encounter.currentTurnIndex, 1);
    const snapshot = await rpc(cluster, f.actors.player1, 'get_session_runtime_snapshot', [f.session], '$1::uuid');
    await cluster.restart();
    assert.deepEqual(await state(cluster), committed);
    assert.deepEqual(await rpc(cluster, f.actors.player1, 'get_session_runtime_snapshot', [f.session], '$1::uuid'), snapshot);
  });
  await probe('BASELINE-SEC-RAW-ATLAS', 'Player direct table access cannot bypass hidden-map RPC projection', async () => {
    const rows = await asActor(cluster, f.actors.player1, async (client) =>
      (await client.query('SELECT id,title FROM public.world_atlas_maps WHERE id=$1', [f.secretMap])).rows);
    assert.equal(rows.length, 0, 'Hidden atlas row is readable directly under authenticated RLS; RPC filtering is insufficient');
  }, 'High');
  await probe('BASELINE-SEC-CROSS-SAGA', 'Membership in saga A cannot read a map revealed only in saga B', async () => {
    const membership = await asActor(cluster, f.actors.player1, async (client) =>
      (await client.query('SELECT public.current_user_is_active_project_member($1) AS member', [f.otherSagaProject])).rows[0].member);
    assert.equal(membership, false);
    let maps;
    try { maps = await rpc(cluster, f.actors.player1, 'list_world_atlas_maps', [f.world, true, f.otherSagaPublicId], '$1::uuid,$2::boolean,$3::text'); }
    catch (error) { if (error.code === '42501') return; throw error; }
    assert(!maps.maps.some((row) => row.id === f.secretMap), 'Player in saga A received the hidden map title from saga B without membership in B');
  }, 'High');
  await probe('BASELINE-SEC-LEGACY-MAP', 'Player cannot disable undiscovered-pin redaction using p_player_view=false', async () => {
    await adminQuery(cluster, `INSERT INTO public.world_maps(world_profile_id,map_data)
      VALUES($1,'{"size":24,"tiles":{},"countries":[],"pins":[{"id":"hidden-pin","name":"Unrevealed legacy pin","discovered":false}]}')`, [f.world]);
    try {
      const safe = await rpc(cluster, f.actors.player1, 'get_world_map', [f.world, true], '$1::uuid,$2::boolean');
      assert.deepEqual(safe.mapData.pins, []);
      const forged = await rpc(cluster, f.actors.player1, 'get_world_map', [f.world, false], '$1::uuid,$2::boolean');
      assert.deepEqual(forged.mapData.pins, [], 'Authenticated player can disable redaction and obtain undiscovered pins');
    } finally { await adminQuery(cluster, 'DELETE FROM public.world_maps WHERE world_profile_id=$1', [f.world]); }
  }, 'High');
  await probe('BASELINE-RPC-RECAP-OVERLOAD', 'Two-argument recap call resolves without overload ambiguity', async () => {
    await rpc(cluster, f.actors.gm, 'save_session_recap_summary', [f.session, 'Synthetic recap'], '$1::uuid,$2::text');
  }, 'Medium');
  await probe('BASELINE-SEC-FOREIGN-LEAVE', 'Foreign owner cannot change another session through leave_play_session', async () => {
    const before = await state(cluster);
    let denied = false;
    try { await rpc(cluster, f.actors.outsider, 'leave_play_session', [f.session], '$1::uuid'); }
    catch (error) { if (error.code === '42501') denied = true; else throw error; }
    const after = await state(cluster);
    assert(denied || JSON.stringify(before) === JSON.stringify(after),
      `Foreign leave mutated revision ${before.revision}→${after.revision}, events ${before.events}→${after.events}`);
  }, 'High');
  for (const role of ['anon', 'authenticated']) {
    await probe(`BASELINE-SEC-EVENT-HELPER-${role.toUpperCase()}`, `${role} cannot append forged session events through a definer helper`, async () => {
      const client = await cluster.client();
      let denied = false;
      let inserted = 0;
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL ROLE ${role}`);
        await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [role === 'authenticated' ? f.actors.outsider : '']);
        try {
          const forged = await client.query(`SELECT public.append_session_event($1,'leave',$2,'{"forged":true}',999,'helper-forgery') AS id`, [f.session, f.actors.gm]);
          await client.query('RESET ROLE');
          inserted = (await client.query('SELECT count(*)::integer AS n FROM public.session_events WHERE id=$1', [forged.rows[0].id])).rows[0].n;
        } catch (error) { if (error.code === '42501') denied = true; else throw error; }
      } finally { await client.query('ROLLBACK'); await client.end(); }
      assert(denied && inserted === 0, `${role} forged ${inserted} event as another actor through append_session_event; test transaction rolled back`);
    }, role === 'anon' ? 'Critical' : 'High');
    await probe(`BASELINE-SEC-ADVENTURE-HELPER-${role.toUpperCase()}`, `${role} cannot claim GM authority in a public adventure helper`, async () => {
      const client = await cluster.client();
      let denied = false;
      let value;
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL ROLE ${role}`);
        await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [role === 'authenticated' ? f.actors.outsider : '']);
        try {
          await client.query(`SELECT public.sagatree_resolve_adventure_command($1,'{"op":"set_flag","key":"forged-admin-flag","value":true}',true,'{"shared":{}}')`, [f.session]);
          await client.query('RESET ROLE');
          value = (await client.query("SELECT adventure_runtime#>'{flags,forged-admin-flag,value}' AS value FROM public.projects WHERE id=$1", [f.project])).rows[0].value;
        } catch (error) { if (error.code === '42501') denied = true; else throw error; }
      } finally { await client.query('ROLLBACK'); await client.end(); }
      assert(denied && value !== true, `${role} wrote a project flag with p_is_gm=true through a definer helper; test transaction rolled back`);
    }, role === 'anon' ? 'Critical' : 'High');
  }
  await probe('PAR-10', 'Real world-profile RLS denies foreign-owner reads (regression canary)', async () => {
    if (injectPolicyRegression) {
      await adminQuery(cluster, 'CREATE POLICY baseline_intentional_allow ON public.world_profiles FOR SELECT TO authenticated USING (true)');
    }
    const rows = await asActor(cluster, f.actors.outsider, async (client) =>
      (await client.query('SELECT id FROM public.world_profiles WHERE id=$1', [f.world])).rows);
    assert.equal(rows.length, 0, 'PAR-10 detected an actual RLS policy allowing a foreign owner');
  }, 'High');
  return report.tests.every((row) => row.status === 'passed');
}
