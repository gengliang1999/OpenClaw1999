const fs = require('fs');
let expertsJs = fs.readFileSync('src/renderer/pages/experts.js', 'utf8');

expertsJs = expertsJs.replace(
  /container\.innerHTML = `[\s\S]*?<!-- 右侧专家列表 -->/,
  `container.className = 'page-layout-full';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';

  container.innerHTML = \`
    <!-- 右侧专家列表 -->`
);

expertsJs = expertsJs.replace(
  /container\.innerHTML = `/,
  `container.innerHTML = \``
);

expertsJs = expertsJs.replace(
  /<\/div>\s*<\/div>\s*`;/,
  `</div>\n  \`;`
);

// Add setSidebar to render
expertsJs = expertsJs.replace(
  /const categories = \[\...new Set\(expertList\.map\(e => e\.category\)\)\];/,
  `const categories = [...new Set(expertList.map(e => e.category))];

  if (window.__app && window.__app.setSidebar) {
    const headerHTML = \`
      <div class="sidebar-search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="expertSearchInput" placeholder="搜索专家..." />
      </div>
    \`;

    const contentHTML = \`
      <div id="expertCategoryList" style="flex: 1; overflow-y: auto; padding: 8px;">
        <!-- 分类列表注入到这里 -->
        <div class="expert-category active" data-category="全部">全部</div>
        \${categories.map(c => \`<div class="expert-category" data-category="\${c}">\${c}</div>\`).join('')}
      </div>
    \`;

    window.__app.setSidebar('专家分类', headerHTML, contentHTML);
  }
`
);

// Remove old dom handlers for sidebar
expertsJs = expertsJs.replace(
  /document\.getElementById\('reopenExpertSidebar'\)\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/,
  ``
);
expertsJs = expertsJs.replace(
  /document\.getElementById\('closeExpertSidebar'\)\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/,
  ``
);


fs.writeFileSync('src/renderer/pages/experts.js', expertsJs);
console.log('Modified experts.js successfully.');
