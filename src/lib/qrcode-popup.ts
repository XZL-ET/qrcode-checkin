/**
 * 安全地打开 QR 码弹窗。
 * 使用 DOM API 设置内容，避免 XSS（不使用 document.write + 字符串拼接）。
 */
export function openQRCodePopup(title: string, qrDataURL: string) {
  const w = window.open('', '_blank', 'width=420,height=650');
  if (!w) return;

  const doc = w.document;

  // 基础样式
  doc.body.style.margin = '0';
  doc.body.style.textAlign = 'center';
  doc.body.style.padding = '20px';
  doc.body.style.fontFamily = 'sans-serif';

  // 标题 — 使用 textContent 防 XSS
  const h2 = doc.createElement('h2');
  h2.textContent = title;
  h2.style.marginBottom = '12px';
  doc.body.appendChild(h2);

  // QR 码图片
  const img = doc.createElement('img');
  img.id = 'qr-img';
  img.src = qrDataURL;
  img.style.maxWidth = '100%';
  img.alt = '签到二维码';
  doc.body.appendChild(img);

  // 提示文字
  const p = doc.createElement('p');
  p.textContent = '扫码即可签到';
  p.style.color = '#888';
  p.style.marginTop = '12px';
  doc.body.appendChild(p);

  // 按钮容器
  const btnDiv = doc.createElement('div');
  btnDiv.style.marginTop = '12px';
  btnDiv.style.display = 'flex';
  btnDiv.style.gap = '8px';
  btnDiv.style.justifyContent = 'center';

  // 下载按钮
  const downloadBtn = doc.createElement('button');
  downloadBtn.id = 'btn-download';
  downloadBtn.textContent = '⬇ 下载二维码';
  downloadBtn.style.padding = '8px 24px';
  downloadBtn.style.border = 'none';
  downloadBtn.style.borderRadius = '4px';
  downloadBtn.style.background = '#4CAF50';
  downloadBtn.style.color = '#fff';
  downloadBtn.style.cursor = 'pointer';
  downloadBtn.style.fontSize = '14px';
  downloadBtn.onclick = () => {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-');
    const a = doc.createElement('a');
    a.href = img.src;
    a.download = `${safeTitle}.png`;
    a.click();
  };
  btnDiv.appendChild(downloadBtn);

  // 关闭按钮
  const closeBtn = doc.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.padding = '8px 24px';
  closeBtn.style.border = '1px solid #ddd';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.background = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '14px';
  closeBtn.onclick = () => w.close();
  btnDiv.appendChild(closeBtn);

  doc.body.appendChild(btnDiv);
}
