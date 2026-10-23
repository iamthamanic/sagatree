import { createHash, randomBytes } from 'node:crypto';

const id = (suffix) => `a7700000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
export const fixture = {
  actors: { owner: id(1), gm: id(2), player1: id(3), player2: id(4), outsider: id(5), otherGm: id(6) },
  world: id(101), foreignWorld: id(102), ownerOnlyWorld: id(103),
  project: id(201), foreignProject: id(202), otherSagaProject: id(203),
  session: id(301), secondSession: id(302), foreignSession: id(303),
  player1Character: id(401), player2Character: id(402),
  rootMap: id(501), secretMap: id(502), foreignMap: id(503),
  place: id(601), secretPlace: id(602),
  locationBinding: id(701), secretBinding: id(702),
  publicNpcBinding: id(703), secretNpcBinding: id(704), otherSagaBinding: id(705),
  worldPublicId: 'WO-FX234', sagaPublicId: 'SA-FX234', foreignSagaPublicId: 'SA-FX235', otherSagaPublicId: 'SA-FX236',
  secretTitle: 'Fixture secret vault', publicTitle: 'Fixture coast',
};

export async function setActor(client, userId) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claims', $2, true)",
    [userId ?? '', JSON.stringify({ role: 'authenticated', ...(userId ? { sub: userId } : {}) })]);
}

export async function asActor(cluster, userId, work, { commit = true } = {}) {
  const client = await cluster.client();
  try {
    await client.query('BEGIN');
    await setActor(client, userId);
    const result = await work(client);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

export async function seedFixtures(client) {
  const password = randomBytes(24).toString('base64url');
  await client.query('BEGIN');
  try {
    for (const [name, userId] of Object.entries(fixture.actors)) {
      await client.query(`INSERT INTO auth.users
        (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change)
        VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated','authenticated',
          $2, extensions.crypt($3, extensions.gen_salt('bf', 4)), now(),
          '{"provider":"email","providers":["email"]}', $4, now(), now(), '', '', '', '')`,
      [userId, `${name}@migration.fixture.invalid`, password, JSON.stringify({ display_name: `Fixture ${name}` })]);
      await client.query(`INSERT INTO auth.identities
        (id,user_id,provider,provider_id,identity_data,created_at,updated_at)
        VALUES (gen_random_uuid(),$1,'email',$2,$3,now(),now())`,
      [userId, `${name}@migration.fixture.invalid`, JSON.stringify({ sub: userId, email: `${name}@migration.fixture.invalid` })]);
    }
    await client.query(`INSERT INTO public.world_profiles(id,public_id,owner_user_id,name) VALUES
      ($1,'WO-FX234',$2,'Synthetic Atlas fixture'),($3,'WO-FX235',$4,'Foreign fixture world'),
      ($5,'WO-FX236',$2,'Owner without GM fixture')`,
    [fixture.world, fixture.actors.owner, fixture.foreignWorld, fixture.actors.outsider, fixture.ownerOnlyWorld]);
    // Seed as administrator with the real owner's auth.uid for the existing
    // world-binding ownership trigger. Policies are never disabled or replaced.
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [fixture.actors.owner]);
    await client.query(`INSERT INTO public.projects(id,public_id,code,name,gm_user_id,world_profile_id)
      VALUES($1,$2,'FXACT01','Synthetic primary saga',$3,$4)`,
    [fixture.project, fixture.sagaPublicId, fixture.actors.gm, fixture.world]);
    await client.query(`INSERT INTO public.projects(id,public_id,code,name,gm_user_id,world_profile_id)
      VALUES($1,$2,'FXACT03','Another saga in the same world',$3,$4)`,
    [fixture.otherSagaProject, fixture.otherSagaPublicId, fixture.actors.otherGm, fixture.world]);
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [fixture.actors.outsider]);
    await client.query(`INSERT INTO public.projects(id,public_id,code,name,gm_user_id,world_profile_id)
      VALUES($1,$2,'FXACT02','Synthetic foreign saga',$3,$4)`,
    [fixture.foreignProject, fixture.foreignSagaPublicId, fixture.actors.outsider, fixture.foreignWorld]);
    for (const [name, userId] of Object.entries(fixture.actors)) {
      if (name === 'owner') continue;
      await client.query(`INSERT INTO public.project_members(project_id,user_id,role,status)
        VALUES($1,$2,$3,'active')`,
      [name === 'outsider' ? fixture.foreignProject : name === 'otherGm' ? fixture.otherSagaProject : fixture.project,
        userId, ['gm', 'outsider', 'otherGm'].includes(name) ? 'gm' : 'player']);
    }
    for (const [name, sessionId, projectId, publicId] of [
      ['primary', fixture.session, fixture.project, 'SE-FX234'],
      ['second', fixture.secondSession, fixture.project, 'SE-FX235'],
      ['foreign', fixture.foreignSession, fixture.foreignProject, 'SE-FX236'],
    ]) {
      await client.query(`INSERT INTO public.sessions(id,public_id,project_id,session_number,name,status,code,world_state)
        VALUES($1,$2,$3,$4,$5,'active',$6,'{"shared":{},"gmSecret":"fixture session secret"}')`,
      [sessionId, publicId, projectId, name === 'second' ? 2 : 1, `Fixture ${name}`, `FXS${name === 'primary' ? '01' : name === 'second' ? '02' : '03'}`]);
    }
    for (const [name, characterId, publicId] of [['player1', fixture.player1Character, 'CH-FX234'], ['player2', fixture.player2Character, 'CH-FX235']]) {
      await client.query(`INSERT INTO public.characters(
          id,public_id,owner_user_id,project_id,name,character_type,sheet_status,
          ruleset_key,level,attributes,skills,sagatree_profile,
          inventory_v2,inventory_schema_version)
        VALUES(
          $1,$2,$3,$4,$5,'pc','complete','sagatree-core',1,
          '{"strength":3,"dexterity":3,"endurance":3,"intelligence":3,"wisdom":3,"charisma":3}'::jsonb,
          '{"athletics":2,"awareness":1,"melee":1}'::jsonb,
          '{"drive":3}'::jsonb,
          '{"schemaVersion":2,"instances":[]}',2)`,
      [characterId, publicId, fixture.actors[name], fixture.project, `Fixture ${name}`]);
      for (const sessionId of [fixture.session, fixture.secondSession]) {
        await client.query('INSERT INTO public.session_players(session_id,user_id,character_id,is_online) VALUES($1,$2,$3,true)',
          [sessionId, fixture.actors[name], characterId]);
      }
    }
    const meta = { engine: 'unified_canvas', mapStatus: 'ready', demoSeed: false,
      unifiedCanvas: { format: 'sagatree-unified-atlas-v1', revision: 1, demoSeed: false, objects: [], strokes: [], walls: [], rooms: [] } };
    const layers = { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [50, 50] }, properties: { name: 'Public landmark' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [80, 80] }, properties: { name: 'Secret landmark', secret: true } },
    ] };
    for (const [mapId, worldId, parentId, title] of [
      [fixture.rootMap, fixture.world, null, fixture.publicTitle],
      [fixture.secretMap, fixture.world, fixture.rootMap, fixture.secretTitle],
      [fixture.foreignMap, fixture.foreignWorld, null, 'Foreign private map'],
    ]) {
      await client.query(`INSERT INTO public.world_atlas_maps
        (id,world_profile_id,parent_map_id,kind,title,bounds,layers,generator_meta)
        VALUES($1,$2,$3,'world',$4,'{"minX":0,"minY":0,"maxX":1000,"maxY":1000}',$5,$6)`,
      [mapId, worldId, parentId, title, layers, meta]);
    }
    await client.query(`INSERT INTO public.world_places(id,world_profile_id,kind,name,status)
      VALUES($1,$2,'continent','Fixture continent','canonical'),($3,$2,'place','Fixture hidden place','canonical')`,
    [fixture.place, fixture.world, fixture.secretPlace]);
    await client.query(`INSERT INTO public.world_place_map_links(world_profile_id,place_id,map_id,usage)
      VALUES($1,$2,$3,'primary'),($1,$4,$5,'primary')`,
    [fixture.world, fixture.place, fixture.rootMap, fixture.secretPlace, fixture.secretMap]);
    await client.query(`INSERT INTO public.saga_asset_bindings(id,project_id,asset_kind,asset_id,world_place_id,reveal,label)
      VALUES($1,$2,'location','fixture-coast',$3,'gm_only','Fixture coast'),
            ($4,$2,'location','fixture-secret',$5,'gm_only','Fixture hidden place'),
            ($6,$2,'npc','fixture-public-npc',NULL,'party','Fixture friendly NPC'),
            ($7,$2,'npc','fixture-secret-npc',NULL,'gm_only','Fixture secret NPC')`,
    [fixture.locationBinding, fixture.project, fixture.place, fixture.secretBinding, fixture.secretPlace, fixture.publicNpcBinding, fixture.secretNpcBinding]);
    await client.query(`INSERT INTO public.saga_asset_bindings(id,project_id,asset_kind,asset_id,world_place_id,reveal,label)
      VALUES($1,$2,'location','fixture-other-saga-only',$3,'party','Only revealed in the other saga')`,
    [fixture.otherSagaBinding, fixture.otherSagaProject, fixture.secretPlace]);
    const members = (await client.query('SELECT id FROM public.project_members WHERE project_id=$1 AND role=\'player\'', [fixture.project])).rows;
    // The same GM-managed RPC used by the product assigns the real player bundle.
    await setActor(client, fixture.actors.gm);
    for (const member of members) {
      await client.query('SELECT public.set_saga_member_bundle($1,$2,\'bundle.saga.player\')', [fixture.project, member.id]);
    }
    await client.query('RESET ROLE');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  return { ...fixture, password };
}

/**
 * Deterministic semantic fingerprint of the synthetic fixture graph.
 * Omits auth password hashes and volatile timestamps so two fresh seeds match.
 */
export async function computeSemanticChecksum(client) {
  const { rows } = await client.query(`
    SELECT jsonb_build_object(
      'actors', (SELECT jsonb_agg(jsonb_build_object('id', id, 'email', email) ORDER BY id)
                 FROM auth.users WHERE id = ANY($1::uuid[])),
      'memberships', (SELECT jsonb_agg(jsonb_build_object(
                        'project_id', m.project_id, 'user_id', m.user_id, 'role', m.role, 'status', m.status,
                        'bundle_id', b.bundle_id) ORDER BY m.project_id, m.user_id)
                      FROM public.project_members m
                      LEFT JOIN public.project_member_saga_bundles b ON b.member_id = m.id
                      WHERE m.project_id = ANY($2::uuid[])),
      'worlds', (SELECT jsonb_agg(jsonb_build_object(
                   'id', id, 'public_id', public_id, 'owner_user_id', owner_user_id, 'name', name)
                   ORDER BY id)
                 FROM public.world_profiles WHERE id = ANY($3::uuid[])),
      'projects', (SELECT jsonb_agg(jsonb_build_object(
                     'id', id, 'public_id', public_id, 'gm_user_id', gm_user_id,
                     'world_profile_id', world_profile_id, 'code', code, 'name', name) ORDER BY id)
                   FROM public.projects WHERE id = ANY($2::uuid[])),
      'sessions', (SELECT jsonb_agg(jsonb_build_object(
                     'id', id, 'public_id', public_id, 'project_id', project_id,
                     'session_number', session_number, 'name', name, 'status', status, 'code', code,
                     'world_state', world_state) ORDER BY id)
                   FROM public.sessions WHERE id = ANY($4::uuid[])),
      'session_players', (SELECT jsonb_agg(jsonb_build_object(
                            'session_id', session_id, 'user_id', user_id, 'character_id', character_id)
                            ORDER BY session_id, user_id)
                          FROM public.session_players WHERE session_id = ANY($4::uuid[])),
      'characters', (SELECT jsonb_agg(jsonb_build_object(
                       'id', id, 'public_id', public_id, 'owner_user_id', owner_user_id,
                       'project_id', project_id, 'name', name, 'inventory_v2', inventory_v2,
                       'inventory_schema_version', inventory_schema_version) ORDER BY id)
                     FROM public.characters WHERE id = ANY($5::uuid[])),
      'maps', (SELECT jsonb_agg(jsonb_build_object(
                 'id', id, 'world_profile_id', world_profile_id, 'parent_map_id', parent_map_id,
                 'title', title, 'layers', layers, 'generator_meta', generator_meta) ORDER BY id)
               FROM public.world_atlas_maps WHERE id = ANY($6::uuid[])),
      'places', (SELECT jsonb_agg(jsonb_build_object(
                   'id', id, 'world_profile_id', world_profile_id, 'kind', kind, 'name', name, 'status', status)
                   ORDER BY id)
                 FROM public.world_places WHERE id = ANY($7::uuid[])),
      'place_map_links', (SELECT jsonb_agg(jsonb_build_object(
                            'world_profile_id', world_profile_id, 'place_id', place_id,
                            'map_id', map_id, 'usage', usage) ORDER BY place_id, map_id)
                          FROM public.world_place_map_links
                          WHERE world_profile_id = ANY($3::uuid[])),
      'bindings', (SELECT jsonb_agg(jsonb_build_object(
                     'id', id, 'project_id', project_id, 'asset_kind', asset_kind, 'asset_id', asset_id,
                     'world_place_id', world_place_id, 'reveal', reveal, 'label', label) ORDER BY id)
                   FROM public.saga_asset_bindings WHERE id = ANY($8::uuid[])),
      'fixed_ids', $9::jsonb
    ) AS payload
  `, [
    Object.values(fixture.actors),
    [fixture.project, fixture.foreignProject, fixture.otherSagaProject],
    [fixture.world, fixture.foreignWorld, fixture.ownerOnlyWorld],
    [fixture.session, fixture.secondSession, fixture.foreignSession],
    [fixture.player1Character, fixture.player2Character],
    [fixture.rootMap, fixture.secretMap, fixture.foreignMap],
    [fixture.place, fixture.secretPlace],
    [
      fixture.locationBinding, fixture.secretBinding, fixture.publicNpcBinding,
      fixture.secretNpcBinding, fixture.otherSagaBinding,
    ],
    JSON.stringify({
      worldPublicId: fixture.worldPublicId,
      sagaPublicId: fixture.sagaPublicId,
      foreignSagaPublicId: fixture.foreignSagaPublicId,
      otherSagaPublicId: fixture.otherSagaPublicId,
      secretTitle: fixture.secretTitle,
      publicTitle: fixture.publicTitle,
      actors: fixture.actors,
    }),
  ]);
  const payload = rows[0]?.payload ?? {};
  const canonical = JSON.stringify(payload);
  return {
    algorithm: 'sha256',
    sha256: createHash('sha256').update(canonical).digest('hex'),
    payloadByteLength: Buffer.byteLength(canonical),
  };
}
