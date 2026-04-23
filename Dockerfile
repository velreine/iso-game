# ── Build stage: just copy static files (no build step needed) ───────────────
FROM nginx:1.25-alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy game files
COPY index.html   /usr/share/nginx/html/
COPY game.js      /usr/share/nginx/html/
COPY style.css    /usr/share/nginx/html/
COPY version.txt  /usr/share/nginx/html/
COPY levels/      /usr/share/nginx/html/levels/
COPY editor.html  /usr/share/nginx/html/
COPY editor.js    /usr/share/nginx/html/
COPY editor.css   /usr/share/nginx/html/

# Use custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
