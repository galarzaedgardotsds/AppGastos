# Edgar Finanzas PRO 💎 (v6.0)

Aplicación web progresiva (PWA) de finanzas personales, gestión de cuotas y división grupal desarrollada por Edgar.

## Novedades Versión 6.0
- ✏️ **Edición de Movimientos:** Modificá cualquier ingreso o gasto previo con precarga de datos, fotos y fechas sin tener que volver a crearlo.
- 💳 **Gestión Inteligente de Cuotas:** Cada compra en cuotas cuenta con un identificador de grupo (`grupoCuotaId`). Al eliminar, podés elegir si borrar únicamente la cuota del mes o todo el plan de pagos.
- 📊 **Gráfico de Evolución Comparativa:** Nuevo gráfico interactivo en `#view-charts` con barras de Ingresos vs. Gastos de los últimos 6 meses.
- 💰 **Modo Saldo Acumulado:** Switch para alternar entre ver solo el balance neto del mes aislado o arrastrar el saldo histórico acumulado.
- 🤝 **Integración Dividir Salida ➔ Me Deben:** Botón directo `"➕ Anotar deuda"` en cada liquidación de salida grupal para registrar deudas en un toque.
- 🔔 **Sistema de Notificaciones Toast:** Mensajes flotantes elegantes integrados a la interfaz en sustitución de los carteles nativos.
- 🛡️ **Seguridad y Almacenamiento:** Sanitización HTML (`escaparHTML`) en todos los textos de usuario, protección `QuotaExceededError` en `localStorage` y medidor visual de memoria usada.
- 📱 **PWA Maskable:** Íconos adaptables con propósito `any maskable` para encajar perfecto en cualquier launcher Android/iOS.

## Características Clásicas
- 👥 **Gestión de Amigos y Deudas:** Control de quién te debe plata, abonos parciales, saldo pendiente y registro automático a ingresos.
- 🍻 **Dividir Salidas (Estilo Splitwise):** Calculadora grupal con transferencias mínimas y copia para WhatsApp.
- 📱 **PWA Offline Standalone:** Instalable desde navegador y operativa al 100% sin conexión a internet.
- 🔒 **Bloqueo con PIN:** Seguridad biométrica/numérica de 4 dígitos.
- 🔁 **Gastos Fijos y Suscripciones:** Automatización de cobros mensuales recurrentes.
- 🎯 **Metas de Ahorro:** Chanchito virtual con porcentaje de progreso y depósitos.
- 📸 **Comprobantes y Tickets:** Compresión de imágenes y visor en pantalla completa.
- 🧮 **Calculadora Rápida:** Ingreso con operaciones aritméticas directas (`1500+2300`).
- 💾 **Exportación y Respaldo:** Descarga en Excel (CSV) y JSON.
