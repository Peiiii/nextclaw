const entries = {
  studio: 'studio', workdesk: 'studio-workdesk', inbox: 'inbox',
  day: 'day', brief: 'brief', desk: 'desk', original: 'desk-original'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const entry = url.hostname.endsWith('.design.bibo.bot')
      ? entries[url.hostname.split('.')[0]] : null;
    if (entry && url.pathname === '/') {
      url.pathname = `/${entry}`;
      return Response.redirect(url.toString(), 302);
    }
    return env.ASSETS.fetch(request);
  }
};
