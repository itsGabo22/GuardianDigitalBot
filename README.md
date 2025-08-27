# GuardianDigitalBot

Bot de WhatsApp con análisis de mensajes usando OpenAI, Google Safe Browsing y VirusTotal.

## ✨ Características

- **Análisis de Contenido:** Detecta estafas, noticias falsas y enlaces maliciosos en textos.
- **Transcripción de Audio:** Convierte mensajes de voz a texto y los analiza.
- **Verificación de Enlaces:** Usa VirusTotal para escanear URLs en busca de malware.
- **Inteligencia Artificial:** Utiliza OpenAI (GPT) para determinar la intención y analizar el contenido.
- **Persistencia de Datos:** Guarda interacciones y feedback en una base de datos PostgreSQL.
- **Conexión Directa:** Usa BuilderBot para conectar directamente con WhatsApp.

## 🚀 Puesta en Marcha

Sigue estos pasos para tener el bot funcionando en tu entorno local.

### **1. Prerrequisitos**

- [Node.js](https://nodejs.org/) (v18 o superior)
- [PostgreSQL](https://www.postgresql.org/download/)
- Claves de API para:
  - [OpenAI](https://platform.openai.com/api-keys)
  - [Google Cloud](https://console.cloud.google.com/) (para Safe Browsing y Custom Search)
  - [VirusTotal](https://developers.virustotal.com/v3.0/reference/getting-started)

### **2. Instalación**

1.  **Clona el repositorio:**

    ```bash
    git clone https://github.com/itsGabo22/GuardianDigitalBot.git
    cd GuardianDigitalBot
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

### **3. Configuración del Entorno**

Este es el paso más importante para que el bot funcione correctamente.

1.  **Crea tu archivo de entorno:**
    Busca el archivo `.env.example` en la raíz del proyecto. Este archivo es una plantilla que muestra todas las variables que el bot necesita. Haz una copia de este archivo y renómbrala a `.env`.

    ```bash
    # En Windows (Command Prompt)
    copy .env.example .env

    # En Windows (PowerShell)
    Copy-Item .env.example .env

    # En Linux/macOS
    cp .env.example .env
    ```

2.  **Rellena tus credenciales:**
    Abre el nuevo archivo `.env` y rellena cada una de las variables con tus propias claves de API y credenciales. **Este archivo es ignorado por Git y nunca debe ser compartido.**

    ```dotenv
    # .env
    OPENAI_API_KEY=sk-xxxxxxxxxxxx
    GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxx
    # ... y así con el resto de variables
    ```

### **4. Base de Datos**

1.  Asegúrate de que tu servidor de PostgreSQL esté corriendo.
2.  Crea una base de datos con el nombre que especificaste en `DB_NAME` (por defecto `GuardianDigital`).
3.  Ejecuta el script `schema.sql` para crear las tablas necesarias. Puedes usar una herramienta como `psql` o un cliente gráfico como DBeaver/PgAdmin.
    ```bash
    psql -U tu_usuario -d GuardianDigital -f ./src/database/schema.sql
    ```

### **5. Ejecución**

1.  **Compila el proyecto TypeScript:**

    ```bash
    npx tsc
    ```

2.  **Inicia el servidor:**

    ```bash
    npm run dev
    ```

    Si todo está bien, verás un mensaje de que el bot está listo y, a continuación, el código QR.

3.  **Escanea el Código QR:**
    - Abre WhatsApp en tu teléfono, ve a `Configuración > Dispositivos vinculados` y escanea el código que aparece en la terminal.

¡Listo! El bot estará conectado a tu número y respondiendo a los mensajes.

## 🤝 Contribuir

1.  Haz un fork del repositorio.
2.  Crea una rama nueva para tu funcionalidad (`git checkout -b feature/nueva-caracteristica`).
3.  Haz tus cambios y `commit` (`git commit -m 'feat: Agrega nueva característica'`).
4.  Haz `push` a tu rama (`git push origin feature/nueva-caracteristica`).
5.  Abre un Pull Request.
