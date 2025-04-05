// 初始化PDF库
const { jsPDF } = window.jspdf;

// DOM元素
const paperElement = document.getElementById('paper');
const textContainer = document.getElementById('text-content');
const paperSizeSelect = document.getElementById('paper-size');
const fontFamilySelect = document.getElementById('font-family');
const printBtn = document.getElementById('print-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');

// 模板检测正则
const PATTERNS = {
  PHONE: /(1[3-9]\d{9})|(\d{3,4}-\d{7,8})/,
  TITLE: /^【.+】|^[A-Za-z0-9\u4e00-\u9fa5]{2,20}[：:]/
};

// 初始化
function init() {
  // 事件监听
  paperSizeSelect.addEventListener('change', updatePaperSize);
  fontFamilySelect.addEventListener('change', updateFontFamily);
  printBtn.addEventListener('click', printDocument);
  exportPdfBtn.addEventListener('click', exportToPDF);
  textContainer.addEventListener('input', debounce(applySmartLayout, 300));
  
  // 初始布局
  updatePaperSize();
  applySmartLayout();
}

// 智能排版主函数
function applySmartLayout() {
  const text = textContainer.innerText;
  const features = analyzeText(text);
  
  // 重置样式
  textContainer.className = 'text-container';
  
  // 应用模板
  if (features.PHONE) {
    textContainer.innerHTML = text.replace(
      PATTERNS.PHONE, 
      '<div class="phone-block">$&</div>'
    );
  }
  
  if (features.TITLE) {
    const title = text.match(/^.+?(?=\n|$)/)[0];
    textContainer.innerHTML = textContainer.innerHTML.replace(
      title,
      `<div class="title-block">${title}</div>`
    );
  }
  
  // 计算最佳字号
  calculateOptimalFontSize();
  
  // 启用字符着色
  enableCharColor();
}

// 文本分析
function analyzeText(text) {
  return {
    PHONE: PATTERNS.PHONE.test(text),
    TITLE: PATTERNS.TITLE.test(text)
  };
}

// 字号计算（二分法）
function calculateOptimalFontSize() {
  const container = textContainer;
  const paper = paperElement;
  
  let min = 8, max = 72;
  let bestSize = 12;
  
  const originalContent = container.innerHTML;
  const testElement = container.cloneNode(true);
  testElement.style.visibility = 'hidden';
  testElement.style.position = 'absolute';
  document.body.appendChild(testElement);
  
  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    testElement.style.fontSize = `${mid}px`;
    
    if (testElement.scrollHeight > paper.clientHeight || 
        testElement.scrollWidth > paper.clientWidth) {
      max = mid - 1;
    } else {
      bestSize = mid;
      min = mid + 1;
    }
  }
  
  document.body.removeChild(testElement);
  container.style.fontSize = `${bestSize - 1}px`;
}

// 字符着色功能
function enableCharColor() {
  const walker = document.createTreeWalker(
    textContainer, 
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  
  textNodes.forEach(node => {
    if (node.parentNode.classList.contains('char-color')) return;
    
    const chars = node.textContent.split('');
    const parent = node.parentNode;
    const newElements = chars.map(c => {
      const span = document.createElement('span');
      span.className = 'char-color';
      span.textContent = c;
      span.onclick = (e) => {
        if (e.detail === 2) { // 双击
          showColorPicker(span);
        }
      };
      return span;
    });
    
    parent.replaceChild(newElements, node);
  });
}

// 颜色选择器
function showColorPicker(element) {
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = element.style.color || '#000000';
  picker.style.position = 'absolute';
  picker.style.left = '-9999px';
  
  picker.addEventListener('change', () => {
    element.style.color = picker.value;
    document.body.removeChild(picker);
  });
  
  picker.addEventListener('blur', () => {
    document.body.removeChild(picker);
  });
  
  document.body.appendChild(picker);
  picker.click();
}

// 纸张尺寸更新
function updatePaperSize() {
  paperElement.className = paperSizeSelect.value;
  applySmartLayout();
}

// 字体更新
function updateFontFamily() {
  textContainer.style.fontFamily = fontFamilySelect.value;
  calculateOptimalFontSize();
}

// PDF导出
async function exportToPDF() {
  const { offsetWidth: width, offsetHeight: height } = paperElement;
  const originalTransform = paperElement.style.transform;
  
  // 临时调整尺寸
  paperElement.style.width = `${width}px`;
  paperElement.style.height = `${height}px`;
  paperElement.style.transform = 'none';
  
  // 隐藏交互元素
  document.querySelectorAll('.char-color').forEach(el => {
    el.style.pointerEvents = 'none';
  });
  
  try {
    const canvas = await html2canvas(paperElement, {
      scale: 2,
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0
    });
    
    const pdf = new jsPDF({
      orientation: paperSizeSelect.value.includes('landscape') ? 'landscape' : 'portrait',
      unit: 'mm',
      format: paperSizeSelect.value.split('-')[0]
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('document.pdf');
  } catch (error) {
    console.error('PDF导出失败:', error);
    alert('导出PDF时出错，请重试');
  } finally {
    // 恢复状态
    paperElement.style.transform = originalTransform;
    paperElement.style.width = '';
    paperElement.style.height = '';
    document.querySelectorAll('.char-color').forEach(el => {
      el.style.pointerEvents = '';
    });
  }
}

// 打印
function printDocument() {
  const originalTransform = paperElement.style.transform;
  paperElement.style.transform = 'none';
  window.print();
  paperElement.style.transform = originalTransform;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), wait);
  };
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
