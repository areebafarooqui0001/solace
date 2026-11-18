// End-to-end API tests. They start the real server on a temporary database and call it over HTTP.
// Run with:  npm test
const { test, before, after, describe } = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const { spawn } = require( 'node:child_process' );
const http = require( 'node:http' );
const net = require( 'node:net' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const fs = require( 'node:fs' );

const JSON_HEADERS = { 'content-type': 'application/json' };

/** Asks the OS for a free port, which avoids clashes (Windows reserves some port ranges). */
function freePort ()
{
  return new Promise( ( resolve, reject ) =>
  {
    const probe = net.createServer();
    probe.on( 'error', reject );
    probe.listen( 0, '127.0.0.1', () =>
    {
      const { port } = probe.address();
      probe.close( () => resolve( port ) );
    } );
  } );
}

/** Starts the API as a child process with the given env and waits until /health answers (cold starts can be slow). */
async function startServer ( env = {} )
{
  const port = await freePort();
  const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'solace-' ) );
  const proc = spawn( process.execPath, [ path.join( __dirname, '..', 'src', 'server.js' ) ], {
    env: { ...process.env, PORT: String( port ), DB_PATH: path.join( dir, 'test.db' ), JWT_SECRET: 'test-secret', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', ...env },
    stdio: [ 'ignore', 'pipe', 'pipe' ],
  } );
  let output = '';
  proc.stdout.on( 'data', ( c ) => ( output += c ) );
  proc.stderr.on( 'data', ( c ) => ( output += c ) );
  let exited = false;
  proc.on( 'exit', () => ( exited = true ) );

  const base = `http://127.0.0.1:${ port }`;
  for ( let i = 0; i < 300 && !exited; i++ )
  {
    try
    {
      if ( ( await fetch( `${ base }/health` ) ).ok ) return { base, stop: () => proc.kill() };
    } catch { }
    await new Promise( ( r ) => setTimeout( r, 100 ) );
  }
  proc.kill();
  throw new Error( `server did not start${ exited ? ' (it exited)' : ' within 30s' }:\n${ output.slice( -1500 ) }` );
}

const call = ( base, token ) => async ( method, url, body ) =>
{
  const res = await fetch( base + url, {
    method,
    headers: { ...JSON_HEADERS, ...( token ? { authorization: `Bearer ${ token }` } : {} ) },
    body: body === undefined ? undefined : JSON.stringify( body ),
  } );
  return { status: res.status, body: await res.json().catch( () => ( {} ) ) };
};

/** A stand-in for Google's token verification endpoint. */
function startFakeGoogle ()
{
  const tokens = {
    'good-new': { aud: 'CLIENT-1', iss: 'https://accounts.google.com', email: 'Fresh@Gmail.com', email_verified: 'true', given_name: 'Fresh' },
    'wrong-audience': { aud: 'SOMEONE-ELSE', iss: 'accounts.google.com', email: 'x@y.com', email_verified: 'true' },
    unverified: { aud: 'CLIENT-1', iss: 'accounts.google.com', email: 'u@y.com', email_verified: 'false' },
  };
  const server = http.createServer( ( req, res ) =>
  {
    const t = tokens[ new URL( req.url, 'http://x' ).searchParams.get( 'id_token' ) ];
    res.statusCode = t ? 200 : 400;
    res.setHeader( 'content-type', 'application/json' );
    res.end( JSON.stringify( t || { error: 'invalid_token' } ) );
  } );
  return new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', () => resolve( server ) ) );
}

describe( 'Solace API', () =>
{
  let srv, google, api;

  before( async () =>
  {
    google = await startFakeGoogle();
    srv = await startServer( {
      GOOGLE_CLIENT_IDS: 'CLIENT-1',
      GOOGLE_TOKENINFO_URL: `http://127.0.0.1:${ google.address().port }/tokeninfo`,
      DEMO_EMAIL: 'demo@solace.test',
      DEMO_PASSWORD: 'demo-pass-1',
    } );
    api = call( srv.base );
  } );
  after( () =>
  {
    srv?.stop();
    google?.close();
  } );

  const signup = async ( email, extra = {} ) =>
  {
    const r = await api( 'POST', '/auth/signup', { name: 'Asha Khan', email, password: 'secret1', ...extra } );
    assert.equal( r.status, 200 );
    return { token: r.body.token, as: call( srv.base, r.body.token ) };
  };

  test( 'health reports the AI as offline without a key', async () =>
  {
    const r = await api( 'GET', '/health' );
    assert.equal( r.body.ok, true );
    assert.equal( r.body.ai, false );
  } );

  describe( 'accounts', () =>
  {
    test( 'rejects short passwords and duplicate emails (case-insensitive)', async () =>
    {
      assert.equal( ( await api( 'POST', '/auth/signup', { name: 'A', email: 'a@b.com', password: '123' } ) ).status, 400 );
      await signup( 'dup@mail.com' );
      assert.equal( ( await api( 'POST', '/auth/signup', { name: 'B', email: ' DUP@mail.com ', password: 'secret1' } ) ).status, 409 );
    } );

    test( 'check-email tells the app whether an email is free', async () =>
    {
      assert.equal( ( await api( 'POST', '/auth/check-email', { email: 'free@mail.com' } ) ).body.available, true );
      await signup( 'taken@mail.com' );
      assert.equal( ( await api( 'POST', '/auth/check-email', { email: 'TAKEN@mail.com' } ) ).body.available, false );
      assert.equal( ( await api( 'POST', '/auth/check-email', { email: 'nope' } ) ).status, 400 );
    } );

    test( 'login works with the right password only', async () =>
    {
      await signup( 'login@mail.com' );
      assert.equal( ( await api( 'POST', '/auth/login', { email: 'login@mail.com', password: 'secret1' } ) ).status, 200 );
      assert.equal( ( await api( 'POST', '/auth/login', { email: 'login@mail.com', password: 'wrong-pass' } ) ).status, 401 );
    } );

    test( 'protected routes need a valid token', async () =>
    {
      assert.equal( ( await api( 'GET', '/progress' ) ).status, 401 );
      assert.equal( ( await call( srv.base, 'garbage' )( 'GET', '/progress' ) ).status, 401 );
    } );

    test( 'signup answers become goals, a first memory and the check-in reminder time', async () =>
    {
      const { as } = await signup( 'setup@mail.com', { goals: [ 'Feel calmer' ], feeling: 'Stressed', checkinTime: { hour: 21, minute: 15 }, remind: true } );
      const reminders = ( await as( 'GET', '/reminders' ) ).body.reminders;
      const checkin = reminders.find( ( r ) => r.kind === 'checkin' );
      assert.deepEqual( [ checkin.hour, checkin.minute, checkin.enabled ], [ 21, 15, 1 ] );
      const memories = ( await as( 'GET', '/memories' ) ).body.memories;
      assert.match( memories[ 0 ].fact, /Stressed/ );
    } );

    test( 'deleting an account removes the data and invalidates the token', async () =>
    {
      const { token, as } = await signup( 'bye@mail.com' );
      await as( 'POST', '/moods', { score: 4 } );
      assert.equal( ( await as( 'DELETE', '/auth/account' ) ).status, 200 );
      assert.equal( ( await call( srv.base, token )( 'GET', '/progress' ) ).status, 401 );
      assert.equal( ( await api( 'POST', '/auth/check-email', { email: 'bye@mail.com' } ) ).body.available, true );
    } );
  } );

  describe( 'Google sign-in', () =>
  {
    test( 'creates an account for a verified token, then signs in to the same one', async () =>
    {
      const first = await api( 'POST', '/auth/google', { idToken: 'good-new' } );
      assert.equal( first.status, 200 );
      assert.equal( first.body.isNew, true );
      assert.equal( first.body.user.email, 'fresh@gmail.com' );
      assert.equal( ( await api( 'POST', '/auth/google', { idToken: 'good-new' } ) ).body.isNew, false );
    } );

    test( 'rejects tokens for another app, unverified emails and garbage', async () =>
    {
      for ( const idToken of [ 'wrong-audience', 'unverified', 'garbage', '' ] )
      {
        assert.equal( ( await api( 'POST', '/auth/google', { idToken } ) ).status, 401, idToken );
      }
    } );
  } );

  describe( 'XP, streaks and daily rewards', () =>
  {
    test( 'the daily mood check-in pays XP once per day', async () =>
    {
      const { as } = await signup( 'xp@mail.com' );
      assert.equal( ( await as( 'POST', '/moods', { score: 4 } ) ).body.award.gained, 25 );
      assert.equal( ( await as( 'POST', '/moods', { score: 3 } ) ).body.award.gained, 0 );
      const p = ( await as( 'GET', '/progress' ) ).body;
      assert.equal( p.xp, 25 );
      assert.equal( p.streak, 1 );
    } );

    test( 'the small daily challenge is stable for the day and pays once', async () =>
    {
      const { as } = await signup( 'challenge@mail.com' );
      const a = ( await as( 'GET', '/daily/challenge' ) ).body;
      const b = ( await as( 'GET', '/daily/challenge' ) ).body;
      assert.equal( a.title, b.title );
      assert.equal( a.done, false );
      assert.equal( ( await as( 'POST', '/daily/challenge/complete' ) ).body.award.gained, 15 );
      assert.equal( ( await as( 'POST', '/daily/challenge/complete' ) ).body.award.gained, 0 );
      assert.equal( ( await as( 'GET', '/progress' ) ).body.stats.challenges, 1 );
    } );

    test( "Sunny's daily note falls back gracefully without the AI", async () =>
    {
      const { as } = await signup( 'note@mail.com' );
      const n = ( await as( 'GET', '/daily/note' ) ).body;
      assert.ok( n.note.length > 10 && n.affirmation.length > 5 );
      assert.equal( n.personalised, false );
    } );
  } );

  describe( 'chat', () =>
  {
    test( 'conversations keep history and can be deleted with their messages', async () =>
    {
      const { as } = await signup( 'chat@mail.com' );
      const id = ( await as( 'POST', '/conversations' ) ).body.conversation.id;
      const reply = await as( 'POST', `/conversations/${ id }/messages`, { content: 'I feel anxious about work' } );
      assert.equal( reply.body.message.role, 'assistant' );
      assert.equal( reply.body.message.suggestion.kind, 'breathing' ); // offline fallback suggests breathing for anxiety
      assert.equal( ( await as( 'GET', `/conversations/${ id }/messages` ) ).body.messages.length, 2 );
      assert.equal( ( await as( 'DELETE', `/conversations/${ id }` ) ).status, 200 );
      assert.equal( ( await as( 'GET', `/conversations/${ id }/messages` ) ).status, 404 );
    } );

    test( "one person cannot read or write another person's conversation", async () =>
    {
      const alice = await signup( 'alice@mail.com' );
      const bob = await signup( 'bob@mail.com' );
      const id = ( await alice.as( 'POST', '/conversations' ) ).body.conversation.id;
      assert.equal( ( await bob.as( 'GET', `/conversations/${ id }/messages` ) ).status, 404 );
      assert.equal( ( await bob.as( 'POST', `/conversations/${ id }/messages`, { content: 'hi' } ) ).status, 404 );
    } );

    test( 'a crisis message gets Tele-MANAS and no activity, and is never saved as a memory or title', async () =>
    {
      const { as } = await signup( 'crisis@mail.com' );
      const id = ( await as( 'POST', '/conversations' ) ).body.conversation.id;
      const r = await as( 'POST', `/conversations/${ id }/messages`, { content: 'I want to die' } );
      assert.match( r.body.message.content, /14416/ );
      assert.match( r.body.message.content, /112/ );
      assert.equal( r.body.message.suggestion, null );
      const list = ( await as( 'GET', '/conversations' ) ).body.conversations;
      assert.equal( list[ 0 ].title, 'A hard moment' );
    } );

    test( 'memory can be listed, deleted and cleared by the user', async () =>
    {
      const { as } = await signup( 'memory@mail.com', { feeling: 'Low' } );
      const [ m ] = ( await as( 'GET', '/memories' ) ).body.memories;
      assert.ok( m );
      await as( 'DELETE', `/memories/${ m.id }` );
      assert.equal( ( await as( 'GET', '/memories' ) ).body.memories.length, 0 );
    } );
  } );

  describe( 'demo account', () =>
  {
    test( 'is created at startup with a lived-in history', async () =>
    {
      const r = await api( 'POST', '/auth/login', { email: 'demo@solace.test', password: 'demo-pass-1' } );
      assert.equal( r.status, 200 );
      const p = ( await call( srv.base, r.body.token )( 'GET', '/progress' ) ).body;
      assert.ok( p.streak >= 5 );
      assert.ok( p.level >= 2 );
      assert.ok( p.stats.conversations >= 1 );
    } );
  } );
} );

describe( 'abuse protection', () =>
{
  test( 'rate-limits repeated login attempts', async () =>
  {
    const srv = await startServer();
    try
    {
      let last;
      for ( let i = 0; i < 35; i++ )
      {
        last = ( await call( srv.base )( 'POST', '/auth/login', { email: 'x@y.com', password: 'nope-nope' } ) ).status;
      }
      assert.equal( last, 429 );
      assert.equal( ( await fetch( `${ srv.base }/health` ) ).status, 200 ); // the server itself stays healthy
    } finally
    {
      srv.stop();
    }
  } );

  test( 'refuses to start on a host with the example JWT secret', async () =>
  {
    const proc = spawn( process.execPath, [ path.join( __dirname, '..', 'src', 'server.js' ) ], {
      env: { ...process.env, RENDER: 'true', PORT: '0', JWT_SECRET: 'change-me', DB_PATH: path.join( os.tmpdir(), 'solace-secret.db' ) },
      stdio: 'ignore',
    } );
    const code = await new Promise( ( resolve ) => proc.on( 'exit', resolve ) );
    assert.notEqual( code, 0 );
  } );
} );

describe( 'AI safety and structure (with a fake Gemini)', () =>
{
  let srv, fake, requests;

  before( async () =>
  {
    requests = 0;
    fake = http.createServer( ( req, res ) =>
    {
      let body = '';
      req.on( 'data', ( c ) => ( body += c ) );
      req.on( 'end', () =>
      {
        const system = JSON.parse( body ).system_instruction?.parts?.[ 0 ]?.text || '';
        // Only the main chat prompt expects a reply object; helper calls (titles, memories) get something harmless.
        if ( system.includes( 'You are Sunny' ) ) requests++;
        const out = system.includes( 'You are Sunny' )
          ? { reply: 'That sounds heavy.', mood: 'anxious', suggestion: { kind: 'skydiving', why: 'not a real activity' } }
          : 'ok';
        res.setHeader( 'content-type', 'application/json' );
        res.end( JSON.stringify( { candidates: [ { content: { parts: [ { text: typeof out === 'string' ? out : JSON.stringify( out ) } ] } } ] } ) );
      } );
    } );
    await new Promise( ( r ) => fake.listen( 0, '127.0.0.1', r ) );
    srv = await startServer( { GEMINI_API_KEY: 'x', AI_PROVIDER: 'gemini', GEMINI_BASE_URL: `http://127.0.0.1:${ fake.address().port }` } );
  } );
  after( () =>
  {
    srv?.stop();
    fake?.close();
  } );

  const chatAs = async ( email, content ) =>
  {
    const r = await call( srv.base )( 'POST', '/auth/signup', { name: 'Asha', email, password: 'secret1' } );
    const as = call( srv.base, r.body.token );
    const id = ( await as( 'POST', '/conversations' ) ).body.conversation.id;
    return as( 'POST', `/conversations/${ id }/messages`, { content } );
  };

  test( 'a crisis message is answered by the server and never reaches the model', async () =>
  {
    const before = requests;
    const r = await chatAs( 'c1@mail.com', 'I want to end my life' );
    assert.match( r.body.message.content, /14416/ );
    assert.equal( requests, before, 'the model must not be called' );
  } );

  test( 'a normal message goes to the model, and suggestions outside the allowed list are dropped', async () =>
  {
    const before = requests;
    const r = await chatAs( 'c2@mail.com', 'Work has been stressful' );
    assert.equal( requests, before + 1 );
    assert.equal( r.body.message.content, 'That sounds heavy.' );
    assert.equal( r.body.message.mood, 'anxious' );
    assert.equal( r.body.message.suggestion, null );
  } );
} );
