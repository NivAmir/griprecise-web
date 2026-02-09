# 🦾 GRIPRECISE: AI-Powered Precision Gripper System

**GRIPRECISE** (Gripper + Precise) is a cutting-edge web platform designed for intelligent robotic control and monitoring. The system integrates **Edge AI** for real-time material recognition with **Live Telemetry** for high-precision pressure analysis.

---

## 🌐 Project Overview
The platform provides a comprehensive interface for operating a robotic gripper, ensuring safe handling of various objects through sensor feedback and machine learning.

### 📄 Site Structure
* **🏠 Home (index.html):** Overview of the project mission and naming.
* **📊 Dashboard:** Central control hub featuring live camera stream, AI classification, and real-time pressure charts.
* **🖼️ Gallery:** Documentation of hardware components and experimental setups.
* **📖 About:** Technical specifications, system architecture, and project goals.
* **🔐 Login:** Secure authentication portal via Firebase.

---

## ✨ Key Features
* **Edge AI Recognition:** Identifies materials (Metal, Plastic, Wood, etc.) locally in the browser using **TensorFlow.js**.
* **Live Telemetry Monitoring:** Real-time visualization of grip pressure (Left vs. Right) using **Chart.js**.
* **Intelligent Safety Logic:** Automatically suggests or applies pressure limits based on the identified material.
* **Data Export:** Supports exporting experimental data to **CSV** for further scientific analysis.
* **Adaptive UI:** Fully responsive design with automatic **Dark Mode** support based on system settings.

---

## 🛠️ Tech Stack
* **Languages:** HTML5, CSS3, JavaScript (ES6).
* **Frameworks:** Bootstrap 5 (UI), Chart.js (Visualization).
* **AI/ML:** Google Teachable Machine & TensorFlow.js.
* **Cloud/Backend:** Google Firebase (Real-time DB & Auth).
* **Hardware Interface:** ESP32-CAM & Altera DE10-Lite.

---

## 👥 Authors
* **Niv Amir** - [GitHub Profile](https://github.com/NivAmir)

---

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
