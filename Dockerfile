# The asset image currently exists only for amd64. It is used only as a
# file source, so the target image can still be built for arm64.
ARG ASSET_PLATFORM=linux/amd64
FROM --platform=${ASSET_PLATFORM} ghcr.io/5etools-mirror-3/5etools-2014-img:latest AS image-assets

FROM alpine

RUN apk add --no-cache lighttpd rsync

COPY --from=image-assets /etc/lighttpd/lighttpd.conf /etc/lighttpd/mime-types.conf /etc/lighttpd/
COPY --from=image-assets /var/www/localhost/htdocs/img /var/www/localhost/htdocs/img

COPY . /var/www/localhost/htdocs/

WORKDIR /var/www/localhost/htdocs

CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]

EXPOSE 80
