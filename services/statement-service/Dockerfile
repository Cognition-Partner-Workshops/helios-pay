# PHP 8.5.11 is below the 8.5.12 patched floor, so this runtime is affected by
# PHP2Shell (CVE-2026-109618, CVE-2026-109619). mod_php is the highest-risk SAPI.
# INTENTIONALLY VULNERABLE — demo use only. Do not deploy.
FROM php:8.5.11-apache-bookworm

RUN docker-php-ext-install session >/dev/null 2>&1 || true

COPY conf/php-vuln.ini /usr/local/etc/php/conf.d/zz-php2shell-vuln.ini
COPY conf/remittance.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html
COPY . /var/www/html
RUN mkdir -p /var/www/html/data && chown -R www-data:www-data /var/www/html/data

ENV STATEMENT_RUNTIME_CHECKS=1
EXPOSE 80
