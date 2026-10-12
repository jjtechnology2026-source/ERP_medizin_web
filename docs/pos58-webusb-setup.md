# POS58 por WebUSB — setup por PC

Guía para que el ERP imprima los comprobantes **"No Fiscal"** (factura, nota de crédito,
reporte Z y X) en la impresora térmica **POS58** conectada por USB.

- Dispositivo: **`0483:070b` "USB Printer Port"**, interfaz **clase 7 (Printer)**.
- Transporte: **WebUSB** (no Web Serial: el dispositivo no es CDC-ACM).
- Navegador: **Chrome o Edge** (Firefox y Safari no soportan WebUSB), en **HTTPS**
  (`https://erp.medizins.com` = contexto seguro).

---

## Linux — regla udev

Chrome no puede reclamar la interfaz mientras el driver de kernel `usblp` la tiene tomada
(síntoma: `claimInterface` → `Access denied`). Hay que **desvincular `usblp`** para este
dispositivo y dar permisos.

Crear `/etc/udev/rules.d/99-pos58-webusb.rules`:

```udev
# POS58 (0483:070b): permitir a Chrome/WebUSB reclamar la impresora
SUBSYSTEM=="usb", ATTR{idVendor}=="0483", ATTR{idProduct}=="070b", MODE="0666", TAG+="uaccess"

# Desvincular el driver usblp de la interfaz (para que WebUSB la use)
SUBSYSTEM=="usb", ATTR{idVendor}=="0483", ATTR{idProduct}=="070b", ACTION=="add|change", RUN+="/bin/sh -c 'echo -n %k:1.0 > /sys/bus/usb/drivers/usblp/unbind 2>/dev/null || true'"
```

Aplicar:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
# Reconectar la impresora (o reiniciar). Verificar:
ls /sys/bus/usb/drivers/usblp/   # el 3-8:1.0 de la POS58 NO debe aparecer
```

> La regla desvincula `usblp` **solo para ese dispositivo**; otras impresoras siguen igual.

---

## Windows — driver WinUSB con Zadig

`USBPRINT.sys` (spooler) retiene la interfaz; WebUSB necesita **WinUSB**.

1. Descargar **Zadig** de `zadig.akeo.ie` (portable).
2. Con la POS58 conectada: abrir Zadig → **Options → List All Devices**.
3. Elegir **`USB Printer Port`** (VID `0483`, PID `070b`).
4. En el cuadro de driver destino (derecha) elegir **`WinUSB`**.
5. **Replace Driver** (o *Install Driver*) → esperar “success”.
6. Reconectar la impresora.

> Tras esto la POS58 deja de aparecer como impresora de Windows (el spooler ya no la maneja).
> No hace falta: se imprime por WebUSB.

---

## En la app

1. Abrir el ERP en **Chrome/Edge**.
2. **Configuración fiscal → Emparejar POS58** (una sola vez). Chrome pide permiso del
   dispositivo y queda persistido por origen.
3. Listo: si la factura fiscal falla (máquina local o canal digital), se imprime el
   comprobante **No Fiscal** por la POS58.

---

## Verificación / diagnóstico

```bash
# Linux: confirmar que el dispositivo está presente
lsusb | grep 0483:070b
```

- En Chrome: `chrome://device-log/` (muestra errores de `claimInterface`) y la barra de
  permisos del sitio para USB.
- Si en Linux sigue fallando: verificar que `usblp` esté desvinculado (ver arriba) y que la
  regla udev esté cargada (`udevadm control --reload-rules`).
