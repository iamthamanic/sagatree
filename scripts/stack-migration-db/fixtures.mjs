import { randomBytes } from 'node:crypto';

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
      await client.query(`INSERT INTO public.characters(id,public_id,owner_user_id,project_id,name,character_type,sheet_status,inventory_v2,inventory_schema_version)
        VALUES($1,$2,$3,$4,$5,'pc','incomplete','{"schemaVersion":2,"instances":[]}',2)`,
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
