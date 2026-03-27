'use strict';
(function () {

  /** Convert a File to WebP using Canvas API */
  function convertToWebP(file, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) { reject(new Error('Canvas toBlob returned null')); return; }
            resolve({
              blob: blob,
              originalSize: file.size,
              webpSize: blob.size
            });
          }, 'image/webp', quality / 100);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not load image: ' + file.name));
      };
      img.src = url;
    });
  }

  /** Render one result row */
  function renderResult(file, result, index) {
    var saved  = result.originalSize - result.webpSize;
    var pct    = result.originalSize > 0
      ? Math.round((saved / result.originalSize) * 100)
      : 0;
    var baseName = file.name.replace(/\.[^.]+$/, '');
    var thumbUrl = URL.createObjectURL(result.blob);

    var div = document.createElement('div');
    div.className = 'webp-result-item';
    div.style.cssText = 'display:flex;align-items:center;gap:14px;padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:var(--bg-card);flex-wrap:wrap;';
    div.innerHTML =
      '<img src="' + thumbUrl + '" alt="preview" style="width:64px;height:64px;object-fit:cover;border-radius:6px;flex-shrink:0;" />' +
      '<div style="flex:1;min-width:180px;">' +
        '<div style="font-weight:600;font-size:0.9rem;margin-bottom:4px;color:var(--text);">' + Utils.sanitize(file.name) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary);">' +
          'Original: <strong>' + Utils.formatBytes(result.originalSize) + '</strong> &nbsp;→&nbsp; ' +
          'WebP: <strong>' + Utils.formatBytes(result.webpSize) + '</strong>' +
          (saved > 0
            ? ' &nbsp;<span style="color:var(--green);font-weight:700;">−' + pct + '%</span>'
            : saved < 0
              ? ' &nbsp;<span style="color:var(--orange);font-weight:700;">+' + Math.abs(pct) + '%</span>'
              : '') +
        '</div>' +
      '</div>' +
      '<button class="btn btn--primary" data-idx="' + index + '" data-name="' + Utils.sanitize(baseName) + '" style="flex-shrink:0;">⬇ Download</button>';

    // Download button
    div.querySelector('button').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href     = URL.createObjectURL(result.blob);
      a.download = baseName + '.webp';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
    });

    return div;
  }

  document.addEventListener('DOMContentLoaded', function () {
    Utils.initNavbar();

    var dropZone   = document.getElementById('webp-drop-zone');
    var fileInput  = document.getElementById('webp-file-input');
    var qualSlider = document.getElementById('webp-quality');
    var qualVal    = document.getElementById('webp-quality-val');
    var convertBtn = document.getElementById('webp-convert-btn');
    var resultsEl  = document.getElementById('webp-results');
    var fileListEl = document.getElementById('webp-file-list');

    var files = [];

    // Quality slider live update
    qualSlider.addEventListener('input', function () {
      qualVal.textContent = qualSlider.value + '%';
    });

    // Drop zone click → open file picker
    dropZone.addEventListener('click', function () { fileInput.click(); });

    // Drag & drop
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('drop-zone--active');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('drop-zone--active');
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drop-zone--active');
      addFiles(Array.from(e.dataTransfer.files));
    });

    // File input change
    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) addFiles(Array.from(fileInput.files));
      fileInput.value = '';
    });

    function addFiles(newFiles) {
      newFiles.forEach(function (f) {
        if (!f.type.startsWith('image/')) {
          Utils.showToast('⚠ Skipped ' + f.name + ' — not an image');
          return;
        }
        // Avoid duplicates by name+size
        var dup = files.some(function (x) { return x.name === f.name && x.size === f.size; });
        if (!dup) files.push(f);
      });
      renderFileList();
      convertBtn.disabled = files.length === 0;
    }

    function renderFileList() {
      fileListEl.innerHTML = '';
      if (!files.length) {
        fileListEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No files selected yet.</p>';
        return;
      }
      files.forEach(function (f, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg-card);gap:10px;';
        row.innerHTML =
          '<span style="font-size:0.85rem;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            Utils.sanitize(f.name) +
            ' <span style="color:var(--text-muted);">(' + Utils.formatBytes(f.size) + ')</span>' +
          '</span>' +
          '<button class="btn" style="padding:3px 10px;font-size:0.78rem;" data-remove="' + i + '">✕ Remove</button>';
        row.querySelector('button').addEventListener('click', function () {
          files.splice(i, 1);
          renderFileList();
          convertBtn.disabled = files.length === 0;
        });
        fileListEl.appendChild(row);
      });
    }

    // Initial empty state
    renderFileList();

    // Convert button
    convertBtn.addEventListener('click', async function () {
      if (!files.length) return;
      var quality = parseInt(qualSlider.value, 10);
      Utils.setLoading(convertBtn, true);
      resultsEl.innerHTML = '';

      var successCount = 0;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        try {
          var result = await convertToWebP(f, quality);
          resultsEl.appendChild(renderResult(f, result, i));
          successCount++;
        } catch (err) {
          var errDiv = document.createElement('div');
          errDiv.className = 'alert alert--error';
          errDiv.style.marginBottom = '8px';
          errDiv.innerHTML = '<span class="alert__icon">✕</span> Failed to convert <strong>' + Utils.sanitize(f.name) + '</strong>: ' + Utils.sanitize(err.message);
          resultsEl.appendChild(errDiv);
        }
      }

      Utils.setLoading(convertBtn, false, '🌐 Convert to WebP');
      if (successCount > 0) {
        Utils.showToast('✓ Converted ' + successCount + ' image' + (successCount > 1 ? 's' : '') + ' to WebP');
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

  });

})();
