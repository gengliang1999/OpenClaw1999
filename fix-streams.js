const fs = require('fs');
const file = 'src/backend/model-manager.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix _chatCloudStream
content = content.replace(/for await \(const chunk of response\.body\) \{[\s\S]*?\} catch \(err\) \{/m, 
`const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        buffer += textChunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      throw err;`);

// 2. Fix _chatLocalStream
content = content.replace(/for await \(const chunk of response\.body\) \{[\s\S]*?\} catch \(err\) \{/m, 
`const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        buffer += textChunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          const trimmed = line.trim();
          if (!trimmed) continue;
          
          try {
            const data = JSON.parse(trimmed);
            const content = data.message?.content;
            if (content) {
              fullContent += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      throw err;`);

fs.writeFileSync(file, content);
console.log('Fixed model-manager.js streams');
