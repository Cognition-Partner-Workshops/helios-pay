# PHP 8.5.12 is the patched floor of the 8.5 branch for PHP2Shell
# (CVE-2026-109618, CVE-2026-109619). Do not pin a release below it;
# tests/run.php fails the build's test run if the runtime is affected.
FROM php:8.5.12-apache-bookworm

RUN docker-php-ext-install session >/dev/null 2>&1 || true

COPY conf/php.ini /usr/local/etc/php/conf.d/zz-statement-service.ini
COPY conf/remittance.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html
COPY . /var/www/html
RUN mkdir -p /var/www/html/data && chown -R www-data:www-data /var/www/html/data

ENV STATEMENT_RUNTIME_CHECKS=1
EXPOSE 80
