FROM node:22.14-alpine3.21

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S aelora && adduser -S -G aelora aelora
COPY --chown=aelora:aelora run.mjs ./run.mjs

USER aelora
CMD ["node", "run.mjs"]
