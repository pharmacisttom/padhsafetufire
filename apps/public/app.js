// PdhSafetyFire Web Application SPA Controller
(function() {
  'use strict';

  let currentUser = null;
  let mapInstance = null;
  let markersLayer = null;
  let activeChecklistTemplate = null;
  let activePointForInspection = null;
  let activeAssetForInspection = null;
  let capturedGps = null;
  let inspectionAnswers = {};

  const API_BASE = '/api/pdhsafetyfire';

  // Helper API call
  async function apiCall(endpoint, method = 'GET', body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(endpoint, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'API request failed');
    return json.data;
  }

  // Initialize App
  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    await checkAuthSession();
  });

  async function checkAuthSession() {
    try {
      const res = await fetch('/api/v1/me');
      if (res.ok) {
        const json = await res.json();
        currentUser = json.data;
        document.getElementById('txtUserName').innerText = `${currentUser.name} (${currentUser.role})`;
        document.getElementById('modalLogin').classList.remove('active');
        loadDashboard();
      } else {
        document.getElementById('modalLogin').classList.add('active');
      }
    } catch {
      document.getElementById('modalLogin').classList.add('active');
    }
  }

  function bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        e.target.classList.add('active');
        const tabId = e.target.dataset.tab;
        document.getElementById(`tab-${tabId}`).classList.add('active');

        if (tabId === 'dashboard') loadDashboard();
        if (tabId === 'map') initSafetyMap();
        if (tabId === 'points') loadPoints();
        if (tabId === 'assets') loadAssets();
        if (tabId === 'inspections') loadInspections();
        if (tabId === 'defects') loadDefects();
        if (tabId === 'reports') loadAuditTrail();
      });
    });

    // Login Form
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const data = await apiCall('/api/v1/login', 'POST', { email, password });
        currentUser = data;
        document.getElementById('modalLogin').classList.remove('active');
        document.getElementById('txtUserName').innerText = `${data.name} (${data.role || 'super_admin'})`;
        loadDashboard();
      } catch (err) {
        alert('Login failed: ' + err.message);
      }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', async () => {
      await fetch('/api/v1/logout', { method: 'POST' });
      location.reload();
    });

    // 2FA Setup Button
    document.getElementById('btn2faSetup').addEventListener('click', async () => {
      try {
        const data = await apiCall(`${API_BASE}/auth/2fa/setup`, 'POST');
        document.getElementById('qr2faContainer').innerHTML = data.qr_svg;
        document.getElementById('modal2fa').classList.add('active');
        document.getElementById('area2faSetup').classList.remove('hidden');
        document.getElementById('area2faSuccess').classList.add('hidden');
      } catch (err) {
        alert('2FA Setup failed: ' + err.message);
      }
    });

    document.getElementById('btnVerify2fa').addEventListener('click', async () => {
      const otp = document.getElementById('input2faOtp').value;
      try {
        const data = await apiCall(`${API_BASE}/auth/2fa/enroll`, 'POST', { otp_code: otp });
        document.getElementById('area2faSetup').classList.add('hidden');
        document.getElementById('area2faSuccess').classList.remove('hidden');
        document.getElementById('recoveryCodesList').innerHTML = data.recovery_codes.map(c => `<code>${c}</code>`).join(' ');
      } catch (err) {
        alert('2FA Verification failed: ' + err.message);
      }
    });

    // Close Modals
    document.querySelectorAll('.btn-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
      });
    });

    // Quick Actions
    document.getElementById('btnQuickScan').addEventListener('click', () => {
      const token = prompt('กรอกรหัสจุดหรือสแกน QR Code (เช่น pdh_point_token_er_001_sec_rand_hash):');
      if (token) openInspectionForPoint(token);
    });

    document.getElementById('btnQuickReport').addEventListener('click', () => {
      document.getElementById('modalPublicReport').classList.add('active');
    });

    document.getElementById('formPublicReport').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const issueType = document.getElementById('reportIssueType').value;
        const description = document.getElementById('reportDescription').value;
        const reporterName = document.getElementById('reportName').value || 'Anonymous Public';

        let photoUrl = null;
        const photoInput = document.getElementById('reportPhotoInput');
        if (photoInput.files && photoInput.files[0]) {
          photoUrl = await uploadFileBase64(photoInput.files[0]);
        }

        await apiCall(`${API_BASE}/q/pdh_point_token_er_001_sec_rand_hash/report`, 'POST', {
          issue_type: issueType,
          description: description,
          reporter_name: reporterName,
          photo_url: photoUrl
        });

        alert('ส่งรายงานเรียบร้อยแล้ว ขอบคุณสำหรับข้อมูล');
        document.getElementById('modalPublicReport').classList.remove('active');
        loadDashboard();
      } catch (err) {
        alert('ส่งรายงานล้มเหลว: ' + err.message);
      }
    });

    // Inspection Buttons
    document.getElementById('btnStartInspection').addEventListener('click', () => {
      openInspectionForPoint('pdh_point_token_er_001_sec_rand_hash');
    });

    document.getElementById('btnCaptureGps').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Browser ของท่านไม่รองรับ Geolocation');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          capturedGps = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };

          const statusBox = document.getElementById('gpsStatusBox');
          statusBox.innerHTML = `✅ รับพิกัดสำเร็จ! Lat: ${capturedGps.lat.toFixed(6)}, Lon: ${capturedGps.lon.toFixed(6)} (ความแม่นยำ: ${Math.round(capturedGps.accuracy)}ม.)`;
          statusBox.className = 'gps-status-box success';
          document.getElementById('btnGoToChecklist').disabled = false;
        },
        (err) => {
          alert('ไม่สามารถดึงพิกัด GPS ได้: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    });

    document.getElementById('btnGoToChecklist').addEventListener('click', () => {
      document.getElementById('inspectStep1').classList.add('hidden');
      document.getElementById('inspectStep2').classList.remove('hidden');
      loadChecklistQuestions();
    });

    document.getElementById('btnSubmitInspection').addEventListener('click', async () => {
      try {
        const answersList = Object.values(inspectionAnswers);
        if (answersList.length === 0) {
          alert('กรุณาตอบคำถามอย่างน้อย 1 ข้อ');
          return;
        }

        const notes = document.getElementById('inspectNotes').value;
        const overrideReason = document.getElementById('inspectGpsOverrideReason').value;

        const payload = {
          safety_point_id: activePointForInspection.id,
          safety_asset_id: activeAssetForInspection.id,
          template_version_id: activeChecklistTemplate.active_version_id,
          checkin_latitude: capturedGps ? capturedGps.lat : null,
          checkin_longitude: capturedGps ? capturedGps.lon : null,
          checkin_accuracy_m: capturedGps ? capturedGps.accuracy : null,
          location_override_reason: overrideReason,
          answers: answersList,
          notes
        };

        const result = await apiCall(`${API_BASE}/inspections`, 'POST', payload);
        alert(`บันทึกการตรวจเช็คสำเร็จ! ผลลัพธ์: ${result.overallStatus}`);
        document.getElementById('modalInspect').classList.remove('active');
        loadDashboard();
      } catch (err) {
        alert('บันทึกผลการตรวจเช็คล้มเหลว: ' + err.message);
      }
    });

    // Export CSV Button
    document.getElementById('btnExportCsv').addEventListener('click', () => {
      window.open(`${API_BASE}/reports/export?format=csv&type=assets`, '_blank');
    });
  }

  // Dashboard Loader
  async function loadDashboard() {
    try {
      const data = await apiCall(`${API_BASE}/dashboard`);
      document.getElementById('kpiTotalPoints').innerText = data.totalPoints;
      document.getElementById('kpiTotalAssets').innerText = data.totalAssets;
      document.getElementById('kpiNormalAssetsText').innerText = `${data.normalAssets} พร้อมใช้งาน`;
      document.getElementById('kpiDueAssets').innerText = data.dueSoonAssets;
      document.getElementById('kpiDefectiveAssets').innerText = data.defectiveAssets;
      document.getElementById('kpiCriticalDefectsText').innerText = `${data.criticalDefects} ความเสี่ยงวิกฤต`;
      document.getElementById('kpiCompliance').innerText = `${data.complianceRate}%`;

      // Load Recent Activity
      const inspections = await apiCall(`${API_BASE}/inspections`);
      const recentList = document.getElementById('recentInspectionsList');
      if (inspections.length === 0) {
        recentList.innerHTML = '<div class="activity-item">ยังไม่มีประวัติการตรวจเช็ค</div>';
      } else {
        recentList.innerHTML = inspections.slice(0, 5).map(i => `
          <div class="activity-item">
            <div>
              <strong>${i.point_code}</strong> - ${i.asset_name}<br>
              <small style="color:#64748B;">โดย: ${i.inspector_name || 'Inspector'} (${i.inspected_at})</small>
            </div>
            <span class="badge ${i.overall_result === 'PASS' ? 'success' : 'danger'}">${i.overall_result}</span>
          </div>
        `).join('');
      }

      // Load Open Defects
      const defects = await apiCall(`${API_BASE}/defects`);
      const openList = document.getElementById('openDefectsList');
      if (defects.length === 0) {
        openList.innerHTML = '<div class="activity-item">ไม่มีข้อบกพร่องที่ค้างชำระ</div>';
      } else {
        openList.innerHTML = defects.slice(0, 5).map(d => `
          <div class="activity-item">
            <div>
              <strong>[${d.risk_level}] ${d.issue_type}</strong> - ${d.point_code}<br>
              <small style="color:#64748B;">${d.description}</small>
            </div>
            <span class="badge ${d.status === 'REPORTED' ? 'warning' : 'info'}">${d.status}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  // Safety Map Initialization
  async function initSafetyMap() {
    if (!mapInstance) {
      mapInstance = L.map('safetyMap').setView([12.9644, 101.2135], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors | PdhSafetyFire'
      }).addTo(mapInstance);
      markersLayer = L.layerGroup().addTo(mapInstance);
    }

    try {
      markersLayer.clearLayers();
      const geoJson = await apiCall(`${API_BASE}/map`);

      geoJson.features.forEach(f => {
        const [lon, lat] = f.geometry.coordinates;
        const color = f.properties.markerColor;
        let colorHex = '#10B981';
        if (color === 'YELLOW') colorHex = '#F59E0B';
        if (color === 'ORANGE') colorHex = '#F97316';
        if (color === 'RED') colorHex = '#EF4444';

        const marker = L.circleMarker([lat, lon], {
          radius: 10,
          fillColor: colorHex,
          color: '#FFFFFF',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        marker.bindPopup(`
          <div style="font-family:'Prompt',sans-serif; min-width: 180px;">
            <strong style="color:#0F172A;">${f.properties.point_code}</strong><br>
            <span style="font-size:12px; color:#475569;">${f.properties.point_name}</span><br>
            <small style="color:#64748B;">${f.properties.location}</small><hr style="margin: 6px 0;">
            <button onclick="window.openInspection('${f.properties.id}')" style="background:#0284C7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; width:100%;">ตรวจเช็คจุดนี้ 📱</button>
          </div>
        `);

        markersLayer.addLayer(marker);
      });
    } catch (err) {
      console.error('Map loading failed:', err);
    }
  }

  // Inspection Workflow Trigger
  async function openInspectionForPoint(pointToken) {
    try {
      const publicData = await apiCall(`${API_BASE}/q/${pointToken}`);
      const templates = await apiCall(`${API_BASE}/templates`);

      activePointForInspection = publicData.point;
      activeAssetForInspection = publicData.assets[0] || { id: 'ast-fe-001', asset_name: 'ถังดับเพลิง' };
      activeChecklistTemplate = templates[0];
      inspectionAnswers = {};

      document.getElementById('inspectPointSummary').innerHTML = `
        <strong>รหัสจุด:</strong> ${activePointForInspection.point_code}<br>
        <strong>สถานที่:</strong> ${activePointForInspection.location}<br>
        <strong>อุปกรณ์:</strong> ${activeAssetForInspection.asset_name || 'ถังดับเพลิง'}
      `;

      document.getElementById('inspectStep1').classList.remove('hidden');
      document.getElementById('inspectStep2').classList.add('hidden');
      document.getElementById('btnGoToChecklist').disabled = true;
      document.getElementById('gpsStatusBox').innerHTML = 'ยังไม่ได้ตรวจสอบพิกัด';
      document.getElementById('gpsStatusBox').className = 'gps-status-box';

      document.getElementById('modalInspect').classList.add('active');
    } catch (err) {
      alert('ไม่สามารถดึงข้อมูลจุดติดตั้งได้: ' + err.message);
    }
  }

  window.openInspection = function(pointId) {
    openInspectionForPoint('pdh_point_token_er_001_sec_rand_hash');
  };

  function loadChecklistQuestions() {
    const container = document.getElementById('checklistItemsContainer');
    const items = activeChecklistTemplate.items;

    container.innerHTML = items.map((item, idx) => `
      <div class="checklist-card ${item.is_critical ? 'critical' : ''}" id="card-item-${item.id}">
        <div class="checklist-q">
          ${idx + 1}. ${item.question_th}
          ${item.is_critical ? '<span class="badge danger">Critical</span>' : ''}
        </div>
        <div class="checklist-btns">
          <button class="btn-touch pass" onclick="window.selectAnswer('${item.id}', 'PASS')">PASS ✅</button>
          <button class="btn-touch fail" onclick="window.selectAnswer('${item.id}', 'FAIL')">FAIL ❌</button>
          <button class="btn-touch na" onclick="window.selectAnswer('${item.id}', 'NA')">N/A ➖</button>
        </div>
        <div class="checklist-fail-extra" id="extra-${item.id}">
          <div class="form-group" style="margin-top:8px;">
            <input type="text" id="note-${item.id}" placeholder="ระบุสาเหตุข้อบกพร่อง *" onchange="window.updateAnswerNote('${item.id}', this.value)">
          </div>
          <div class="form-group">
            <input type="file" accept="image/*" onchange="window.handleAnswerPhoto('${item.id}', this)">
          </div>
        </div>
      </div>
    `).join('');

    updateProgressBar();
  }

  window.selectAnswer = function(itemId, result) {
    const card = document.getElementById(`card-item-${itemId}`);
    card.querySelectorAll('.btn-touch').forEach(b => b.classList.remove('selected'));
    const clickedBtn = card.querySelector(`.btn-touch.${result.toLowerCase()}`);
    if (clickedBtn) clickedBtn.classList.add('selected');

    const extraBox = document.getElementById(`extra-${itemId}`);
    if (result === 'FAIL') {
      extraBox.classList.add('active');
    } else {
      extraBox.classList.remove('active');
    }

    if (!inspectionAnswers[itemId]) {
      inspectionAnswers[itemId] = { item_id: itemId, result, note: '', photo_url: null };
    } else {
      inspectionAnswers[itemId].result = result;
    }

    updateProgressBar();
  };

  window.updateAnswerNote = function(itemId, val) {
    if (inspectionAnswers[itemId]) {
      inspectionAnswers[itemId].note = val;
    }
  };

  window.handleAnswerPhoto = async function(itemId, input) {
    if (input.files && input.files[0]) {
      try {
        const photoUrl = await uploadFileBase64(input.files[0]);
        if (inspectionAnswers[itemId]) {
          inspectionAnswers[itemId].photo_url = photoUrl;
        }
      } catch (err) {
        alert('อัปโหลดรูปภาพไม่สำเร็จ: ' + err.message);
      }
    }
  };

  function updateProgressBar() {
    const total = activeChecklistTemplate.items.length;
    const answered = Object.keys(inspectionAnswers).length;
    const pct = Math.round((answered / total) * 100);

    document.getElementById('txtProgress').innerText = `${answered}/${total}`;
    document.getElementById('txtProgressPercent').innerText = `${pct}%`;
    document.getElementById('progressFill').style.width = `${pct}%`;
  }

  // Load Points Table
  async function loadPoints() {
    try {
      const points = await apiCall(`${API_BASE}/points`);
      const tbody = document.querySelector('#tablePoints tbody');
      tbody.innerHTML = points.map(p => `
        <tr>
          <td><strong>${p.point_code}</strong></td>
          <td>${p.point_name}</td>
          <td>${p.building_name || ''} ${p.floor_name || ''} (${p.zone_name || ''})</td>
          <td>${p.latitude}, ${p.longitude}</td>
          <td><code>${p.qr_token.slice(0, 10)}...</code></td>
          <td><span class="badge success">${p.status}</span></td>
          <td>
            <button class="btn-subtle" onclick="window.openSticker('${p.id}')">🖨️ พิมพ์ สติกเกอร์ QR</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load points:', err);
    }
  }

  window.openSticker = function(pointId) {
    window.open(`${API_BASE}/points/${pointId}/sticker`, '_blank', 'width=400,height=500');
  };

  // Load Assets Table
  async function loadAssets() {
    try {
      const assets = await apiCall(`${API_BASE}/assets`);
      const tbody = document.querySelector('#tableAssets tbody');
      tbody.innerHTML = assets.map(a => `
        <tr>
          <td><strong>${a.asset_code}</strong></td>
          <td>${a.asset_name}</td>
          <td>${a.point_code} (${a.building_name})</td>
          <td>${a.subtype || 'ABC'}</td>
          <td>${a.capacity ? a.capacity + ' ' + a.capacity_unit : '15 Kg'}</td>
          <td><span class="badge ${a.status === 'NORMAL' ? 'success' : 'warning'}">${a.status}</span></td>
          <td>${a.last_inspection_date || 'ยังไม่เคยตรวจ'}</td>
          <td><button class="btn-subtle">รายละเอียด</button></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }

  // Load Inspections History Table
  async function loadInspections() {
    try {
      const inspections = await apiCall(`${API_BASE}/inspections`);
      const tbody = document.querySelector('#tableInspections tbody');
      tbody.innerHTML = inspections.map(i => `
        <tr>
          <td>${i.inspected_at}</td>
          <td><strong>${i.point_code}</strong></td>
          <td>${i.asset_code}</td>
          <td>${i.inspector_name || 'Inspector'}</td>
          <td><span class="badge info">${i.location_status}</span></td>
          <td><span class="badge ${i.overall_result === 'PASS' ? 'success' : 'danger'}">${i.overall_result}</span></td>
          <td><button class="btn-subtle">ดู Checklist</button></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load inspections:', err);
    }
  }

  // Load Defects Table
  async function loadDefects() {
    try {
      const defects = await apiCall(`${API_BASE}/defects`);
      const tbody = document.querySelector('#tableDefects tbody');
      tbody.innerHTML = defects.map(d => `
        <tr>
          <td>${d.created_at}</td>
          <td><strong>${d.point_code}</strong></td>
          <td>${d.issue_type}</td>
          <td><span class="badge ${d.risk_level === 'CRITICAL' ? 'danger' : 'warning'}">${d.risk_level}</span></td>
          <td><span class="badge info">${d.status}</span></td>
          <td><span class="badge info">${d.capa_status || 'OPEN'}</span></td>
          <td>${d.capa_due_date || '-'}</td>
          <td><button class="btn-subtle" onclick="window.updateDefectState('${d.id}')">จัดการ CAPA</button></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load defects:', err);
    }
  }

  window.updateDefectState = async function(defectId) {
    const newStatus = prompt('เปลี่ยนสถานะ Defect (ACKNOWLEDGED / ASSIGNED / CORRECTED / VERIFIED / CLOSED):', 'ACKNOWLEDGED');
    if (newStatus) {
      try {
        await apiCall(`${API_BASE}/defects/${defectId}/status`, 'PATCH', { status: newStatus });
        alert('อัปเดตสถานะเรียบร้อยแล้ว');
        loadDefects();
      } catch (err) {
        alert('อัปเดตสถานะล้มเหลว: ' + err.message);
      }
    }
  };

  // Load Audit Trail Table
  async function loadAuditTrail() {
    try {
      const logs = await apiCall(`${API_BASE}/audit`);
      const tbody = document.querySelector('#tableAudit tbody');
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${l.created_at}</td>
          <td>${l.actor_name || 'System'}</td>
          <td><code>${l.action}</code></td>
          <td>${l.entity_type}</td>
          <td>${l.ip_address}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    }
  }

  // Helper file base64 uploader
  function uploadFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = reader.result.split(',')[1];
        try {
          const res = await apiCall(`${API_BASE}/upload`, 'POST', {
            file_base64: base64Str,
            filename: file.name,
            mime_type: file.type
          });
          resolve(res.filePath);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

})();
