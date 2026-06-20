FROM grafana/promtail:2.9.2
COPY promtail-config.yml /etc/promtail/config.yml
