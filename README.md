# Каскад VLESS + Reality с Cloudflare WARP

Пошаговое руководство по развёртыванию двухузлового VPN-каскада на базе [3x-ui](https://github.com/MHSanaei/3x-ui)

## 1. Архитектура

### 1.1 Как это работает

- **iNode** — входной узел в RU-локации: принимает подключения клиентов и маршрутизирует трафик по правилам.
- **oNode** — выходной узел в нужной стране: на нём поднят сайт-заглушка (nginx + Let's Encrypt), повышающая стойкость к блокировкам IP.
- Google-трафик уходит через **Cloudflare WARP** (MASQUE), остальные зарубежные маршруты — через **oNode**.

В руководстве используются домены `kvn.example.com` (iNode) и `site.example.com` (oNode) — замените на свои.

### 1.2 Термины

| Термин                               | Пояснение                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **VLESS**                            | Лёгкий прокси-протокол Xray; основа для Reality.                                                                                  |
| **Reality**                          | Технология маскировки: сервер «заимствует» TLS-рукопожатие реального популярного сайта (`dest`), собственный сертификат не нужен. |
| **XTLS-Vision** (`xtls-rprx-vision`) | Flow для VLESS+Reality; обязателен на сервере и в ссылке клиента.                                                                 |
| **WARP over MASQUE**                 | Туннель до Cloudflare WARP по HTTP/3 (CONNECT-IP) вместо WireGuard; выглядит как обычный HTTPS-трафик.                            |
| **Inbound / Outbound**               | Входящий (принимает клиентов) / исходящий (куда отправляется трафик) узел конфигурации Xray.                                      |
| **Geo-файлы**                        | Базы `geoip`/`geosite` для маршрутизации по странам и категориям сайтов.                                                          |

### 1.3 Честно о компромиссах

- Каскад **не увеличивает** стойкость к блокировкам — наоборот, добавляет узел в цепочку и увеличивает задержки.
- Каскад полезен, когда нужно, например, обойти плату за зарубежный трафик у сотового оператора.
- Стойкость к блокировке IP повышает сайт-заглушка на oNode (nginx + certbot). При желании её можно развернуть и на iNode.
- Руководство не охватывает подписки и дополнительные протоколы (xHTTP, Trojan и т. п.).

## 2. Требования

- Два сервера с Debian 12+ / Ubuntu 22.04+: один в RU-локации (iNode), один в желаемой стране (oNode).
- Домен с возможностью создавать A-записи для обоих узлов.
- Рутовый SSH-доступ к серверам (первый прогон Ansible выполняется под `root`, далее — под созданным админ-пользователем).

## 3. Порты и файрвол

На iNode и oNode правила одинаковые; их устанавливает роль `dauxdu.roles.set_ufw`.

| Адрес:порт          | Сервис | Назначение                                                         |
| ------------------- | ------ | ------------------------------------------------------------------ |
| `0.0.0.0:22222/tcp` | SSH    | SSH + туннель к панели                                             |
| `0.0.0.0:80/tcp`    | —      | на iNode — под ACME-проверки, на oNode — nginx (редирект на HTTPS) |
| `0.0.0.0:443/tcp`   | Xray   | Клиентский вход (VLESS+Reality)                                    |

Порт панели наружу **не открывается** — доступ к ней только через SSH-туннель (раздел [5](#5-доступ-к-панели-управления)).

## 4. Развёртывание через Ansible

Серверы настраиваются Ansible-плейбуками из этого репозитория: SSH-hardening, UFW, пользователи, nginx с сайтом-заглушкой и сертификатом Let's Encrypt (oNode), 3x-ui (оба узла).

### 4.1 Установка Ansible

На Debian/Ubuntu:

```bash
sudo apt update && sudo apt install --no-install-recommends ansible
```

Установить зависимости плейбуков:

```bash
make init
```

### 4.2 Подготовка конфигурации

Скопируйте примеры и заполните своими значениями:

```bash
cp ansible/inventory/hosts.yml.example ansible/inventory/hosts.yml
cp ansible/inventory/group_vars/all.yml.example ansible/inventory/group_vars/all.yml
```

В `hosts.yml` укажите адреса узлов.
В `all.yml` укажите: SSH-порт, админ-пользователя и его публичный ключ, домен oNode, e-mail для Let's Encrypt.

### 4.3 Запуск

```bash
make inode   # провижининг iNode:  базовая настройка + 3x-ui
make onode   # провижининг oNode:  базовая настройка + nginx/сайт + 3x-ui
make site    # обновить только сайт и nginx на oNode
make check   # синтаксическая проверка плейбуков и линт ролей
```

Список всех команд: `make help`.

> **Важно.** После первого прогона под `root` не забудьте обновить `ansible_user`/`ansible_port` в `hosts.yml`, иначе подключение не удастся.

### 4.4 Учётные данные панели

Установщик 3x-ui генерирует **случайные** имя пользователя, пароль, порт и web base path и печатает их по завершении установки. После прогона Ansible выводит их в терминал

## 5. Доступ к панели управления

Порт панели закрыт файрволом, поэтому панель открывается через SSH-туннель.
Пример для oNode:

```bash
ssh -p 22222 <admin_user>@site.example.com -N -L 8888:127.0.0.1:<порт_панели>
```

Затем в браузере: `http://127.0.0.1:8888/<web_base_path>` (порт и путь — из [4.4](#44-учётные-данные-панели)).

Для iNode команда аналогична, с адресом iNode.

## 6. Настройка oNode

На oNode нужен собственный inbound, к которому iNode будет подключаться каскадом (см. [7.3](#73-outbounds-warp-и-каскад-на-onode)).

### 6.1 Inbound

Подключитесь к панели oNode (раздел [5](#5-доступ-к-панели-управления)) → **Inbounds → Add Inbound**:

| Поле               | Значение           |
| ------------------ | ------------------ |
| Remark             | `VLESS-Reality`    |
| Protocol           | `vless`            |
| Port               | `443`              |
| Transmission       | `RAW` (TCP)        |
| Security           | `reality`          |
| uTLS (Fingerprint) | `firefox`          |
| Target (Dest)      | `127.0.0.1:8443`   |
| SNI (Server Names) | `site.example.com` |
| Xver               | `0`                |
| Sniffing           | `http`, `tls`      |

### 6.2 Клиенты

**Clients → Add**:

| Поле              | Значение           |
| ----------------- | ------------------ |
| Email             | iNode              |
| Attached inbounds | `VLESS-Reality`    |
| Flow              | `xtls-rprx-vision` |
| Limit IP          | `1`                |

После создания клиента копируем и сохраняем ссылку

### 6.3 Xray: Basics и DNS

**Xray Configs → Basics → General:**

| Параметр                  | Значение  |
| ------------------------- | --------- |
| Freedom Protocol Strategy | `UseIPv4` |
| Overall Routing Strategy  | `AsIs`    |

**Xray Configs → Basics → Log:**

| Параметр   | Значение  |
| ---------- | --------- |
| Log level  | `warning` |
| Access log | отключить |

**Xray Configs → DNS:**

| Поле           | Значение                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| Query Strategy | `UseIPv4`                                                                    |
| DNS            | 1) `https://1.1.1.1/dns-query` 2) `https://8.8.8.8/dns-query` 3) `localhost` |

## 7. Настройка iNode

### 7.1 Inbound

**Inbounds → Add Inbound** — значения те же, что и на oNode ([6.1](#61-inbound)), но dest должен быть доступен из **RU-локации** (например, `yandex.ru:443`):

| Поле               | Значение              |
| ------------------ | --------------------- |
| Remark             | `VLESS-Reality`       |
| Protocol           | `vless`               |
| Port               | `443`                 |
| Transmission       | `RAW` (TCP)           |
| Security           | `reality`             |
| uTLS (Fingerprint) | `firefox`             |
| Target (Dest)      | `yandex.ru:443`       |
| SNI (Server Names) | `yandex.ru`           |
| Xver               | `0`                   |
| Min Client Ver     | `1.0.0`               |
| Sniffing           | `http`, `tls`, `quic` |

> **Min Client Ver.** Начиная с Xray-core v26.9.8 пустое поле означает «без минимума»; явно сохранённое значение применяется. Старые сборки ядра могли использовать встроенный минимум и отклонять сторонние клиенты — если клиенты не подключаются, проверьте версию ядра и это поле ([документация](https://docs.sanaei.dev/docs/config/reality/)).

### 7.2 Клиенты

**Clients → Add**:

| Поле              | Значение                 |
| ----------------- | ------------------------ |
| Email             | произвольный, уникальный |
| Attached inbounds | `VLESS-Reality`          |
| Flow              | `xtls-rprx-vision`       |
| Limit IP          | `3–5`                    |
| Total GB / Expiry | по необходимости         |

### 7.3 Outbounds: WARP и каскад на oNode

**Xray Configs → Outbounds.** Добавляем два outbound:

**a) WARP через MASQUE** — кнопкой `: more → WARP → + Add WARP over MASQUE outbound`.

Панель сама регистрирует **отдельное** WARP-устройство, регистрирует MASQUE-ключ и добавляет готовый outbound с тегом `warp-masque`; существующая WireGuard-регистрация WARP не затрагивается ([документация MASQUE](https://docs.sanaei.dev/docs/config/masque/)).

**b) Каскад на oNode** — `+ Outbounds → JSON`: вставьте конфигурацию VLESS+Reality с oNode, которую сохранили ранее из [6.2](#62-Клиенты).

В поле `address` подставьте **IP-адрес** oNode вместо домена — меньше задержка и нет зависимости от DNS.

### 7.4 Routing

**Xray Configs → Routing** — правила обрабатываются сверху вниз, побеждает первое совпадение; специфичные правила — выше общих ([документация](https://docs.sanaei.dev/docs/operations/outbounds-routing/)):

```json
[
  {
    "type": "field",
    "inboundTag": ["api"],
    "outboundTag": "api"
  },
  {
    "type": "field",
    "protocol": ["bittorrent"],
    "outboundTag": "blocked"
  },
  {
    "type": "field",
    "enabled": true,
    "ip": ["geoip:private"],
    "outboundTag": "direct"
  },
  {
    "type": "field",
    "enabled": true,
    "domain": ["geosite:private"],
    "outboundTag": "direct"
  },
  {
    "type": "field",
    "enabled": true,
    "domain": [
      "ext:geosite_RU.dat:ru-available-only-inside",
      "regexp:.*\\.ru$",
      "regexp:.*\\.su$",
      "regexp:.*\\.xn--p1ai$",
      "ext:geosite_RU.dat:category-ru"
    ],
    "outboundTag": "direct"
  },
  {
    "type": "field",
    "enabled": true,
    "ip": ["geoip:ru"],
    "outboundTag": "direct"
  },
  {
    "type": "field",
    "enabled": true,
    "domain": ["geosite:category-ai-!cn"],
    "outboundTag": "oNode"
  },
  {
    "type": "field",
    "enabled": true,
    "domain": ["geosite:google"],
    "outboundTag": "warp-masque"
  },
  {
    "type": "field",
    "enabled": true,
    "network": "tcp,udp",
    "outboundTag": "oNode"
  }
]
```

Логика: RU-трафик (IP и домены) — напрямую с iNode; Google — через WARP; всё прочее — через oNode.

### 7.5 Xray: Basics и DNS

**Xray Configs → Basics → General:**

| Параметр                  | Значение       |
| ------------------------- | -------------- |
| Freedom Protocol Strategy | `UseIPv4`      |
| Overall Routing Strategy  | `IPIfNonMatch` |

**Xray Configs → Basics → Log:**

| Параметр   | Значение  |
| ---------- | --------- |
| Log level  | `warning` |
| Access log | отключить |

**Xray Configs → DNS:**

| Поле           | Значение                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| Query Strategy | `UseIPv4`                                                                    |
| DNS            | 1) `https://1.1.1.1/dns-query` 2) `https://8.8.8.8/dns-query` 3) `localhost` |

> **Нюанс `IPIfNonMatch`:** catch-all правило перехватывает доменные соединения до резолва, поэтому `geoip:ru` реально работает только для IP-соединений; RU-сайты по доменам полагаются на списки правила 4 из [7.4](#74-routing). Это штатный компромисс схемы.

### 7.6 Geo-файлы

Geo-файлы (Loyalsoldier, IR, RU) обновляются через меню `x-ui` на сервере — пункт `27` (Update Geo Files) — или командой:

```bash
x-ui update-all-geofiles
```

Обновляйте их на обоих узлах и на клиентах; разумный интервал — раз в две недели.

## 8. Проверка

После настройки клиента подключитесь и проверьте маршрутизацию:

| Проверка                       | Ожидание                                    |
| ------------------------------ | ------------------------------------------- |
| `2ip.io`                       | IP oNode                                    |
| `youtube.com`                  | рядом с логотипом — регион RU (эгресс WARP) |
| `yandex.ru`                    | IP клиента (direct через iNode)             |
| `chatgpt.com`                  | IP oNode                                    |
| `cloudflare.com/cdn-cgi/trace` | `warp=off` (не через WARP)                  |

## 9. Клиентские приложения

| Платформа             | Приложения                                         |
| --------------------- | -------------------------------------------------- |
| Windows, Linux, macOS | [v2rayN](https://github.com/2dust/v2rayN/releases) |
| Android               | v2rayNG, Happ                                      |
| iOS                   | Happ, Shadowrocket                                 |
