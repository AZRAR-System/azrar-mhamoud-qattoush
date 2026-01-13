# 📡 API Documentation - AZRAR Desktop

<div dir="rtl">

توثيق شامل لواجهات برمجة التطبيقات (APIs) في AZRAR Desktop.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [Electron IPC APIs](#electron-ipc-apis)
3. [Database APIs](#database-apis)
4. [Window APIs](#window-apis)
5. [File System APIs](#file-system-apis)
6. [Authentication APIs](#authentication-apis)
7. [أمثلة الاستخدام](#أمثلة-الاستخدام)

---

## 🎯 نظرة عامة

### معمارية API

```
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │ IPC
┌────────▼────────┐
│  Preload Script │
└────────┬────────┘
         │
┌────────▼────────┐
│   Main Process  │
└────────┬────────┘
         │
┌────────▼────────┐
│    Database     │
└─────────────────┘
```

### الوصول إلى APIs

في React components:

```typescript
// الوصول عبر window.api
const result = await window.api.invoke('channel-name', ...args);
```

---

## ⚡ Electron IPC APIs

### Database Operations

#### `db:query`

تنفيذ استعلام قراءة (SELECT).

**المعاملات:**
- `sql` (string): استعلام SQL
- `params?` (any[]): معاملات الاستعلام

**العودة:** `Promise<any[]>`

```typescript
// مثال
const users = await window.api.invoke('db:query', 
  'SELECT * FROM users WHERE role = ?', 
  ['admin']
);
```

---

#### `db:run`

تنفيذ استعلام كتابة (INSERT, UPDATE, DELETE).

**المعاملات:**
- `sql` (string): استعلام SQL
- `params?` (any[]): معاملات الاستعلام

**العودة:** `Promise<{ changes: number, lastInsertRowid: number }>`

```typescript
// مثال
const result = await window.api.invoke('db:run',
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['أحمد', 'ahmad@example.com']
);

console.log(`Inserted row ID: ${result.lastInsertRowid}`);
```

---

#### `db:transaction`

تنفيذ معاملة قاعدة بيانات (Transaction).

**المعاملات:**
- `operations` (Array): مصفوفة من العمليات

**العودة:** `Promise<void>`

```typescript
// مثال
await window.api.invoke('db:transaction', [
  {
    sql: 'INSERT INTO orders (user_id, total) VALUES (?, ?)',
    params: [1, 100]
  },
  {
    sql: 'UPDATE users SET balance = balance - ? WHERE id = ?',
    params: [100, 1]
  }
]);
```

---

### Window Management

#### `window:minimize`

تصغير النافذة.

```typescript
await window.api.invoke('window:minimize');
```

---

#### `window:maximize`

تكبير/استعادة النافذة.

```typescript
await window.api.invoke('window:maximize');
```

---

#### `window:close`

إغلاق النافذة.

```typescript
await window.api.invoke('window:close');
```

---

#### `window:isMaximized`

التحقق من حالة التكبير.

**العودة:** `Promise<boolean>`

```typescript
const isMaximized = await window.api.invoke('window:isMaximized');
```

---

### File Operations

#### `file:read`

قراءة محتوى ملف.

**المعاملات:**
- `filePath` (string): مسار الملف

**العودة:** `Promise<string>`

```typescript
const content = await window.api.invoke('file:read', 'C:/data/file.txt');
```

---

#### `file:write`

كتابة محتوى في ملف.

**المعاملات:**
- `filePath` (string): مسار الملف
- `content` (string): المحتوى المراد كتابته

**العودة:** `Promise<void>`

```typescript
await window.api.invoke('file:write', 'C:/data/file.txt', 'Hello World');
```

---

#### `file:select`

فتح نافذة اختيار ملف.

**المعاملات:**
- `options` (object): خيارات الاختيار

**العودة:** `Promise<string | null>`

```typescript
const filePath = await window.api.invoke('file:select', {
  filters: [
    { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  properties: ['openFile']
});
```

---

### System Operations

#### `app:getVersion`

الحصول على إصدار التطبيق.

**العودة:** `Promise<string>`

```typescript
const version = await window.api.invoke('app:getVersion');
console.log(`App version: ${version}`);
```

---

#### `app:getPath`

الحصول على مسار نظام معين.

**المعاملات:**
- `name` (string): اسم المسار (userData, temp, downloads, etc.)

**العودة:** `Promise<string>`

```typescript
const userDataPath = await window.api.invoke('app:getPath', 'userData');
```

---

#### `app:restart`

إعادة تشغيل التطبيق.

```typescript
await window.api.invoke('app:restart');
```

---

## 🗄️ Database APIs

### Schema

#### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Properties Table

```sql
CREATE TABLE properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  price REAL,
  location TEXT,
  status TEXT DEFAULT 'available',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

### مساعدات Database

```typescript
class DatabaseHelper {
  // Execute query
  static async query<T>(sql: string, params?: any[]): Promise<T[]> {
    return window.api.invoke('db:query', sql, params);
  }

  // Execute run
  static async run(sql: string, params?: any[]) {
    return window.api.invoke('db:run', sql, params);
  }

  // Get single row
  static async getOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }

  // Insert
  static async insert(table: string, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return this.run(sql, values);
  }

  // Update
  static async update(
    table: string,
    data: Record<string, any>,
    where: string,
    whereParams?: any[]
  ) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key) => `${key} = ?`).join(', ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
    return this.run(sql, [...values, ...(whereParams || [])]);
  }

  // Delete
  static async delete(table: string, where: string, whereParams?: any[]) {
    const sql = `DELETE FROM ${table} WHERE ${where}`;
    return this.run(sql, whereParams);
  }
}
```

---

## 📚 أمثلة الاستخدام

### مثال 1: جلب البيانات وعرضها

```typescript
import { useEffect, useState } from 'react';

interface Property {
  id: number;
  title: string;
  price: number;
}

function PropertiesList() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await window.api.invoke('db:query',
        'SELECT * FROM properties WHERE status = ?',
        ['available']
      );
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      {properties.map((property) => (
        <div key={property.id}>
          <h3>{property.title}</h3>
          <p>السعر: {property.price}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### مثال 2: إضافة عقار جديد

```typescript
import { useState } from 'react';

function AddPropertyForm() {
  const [formData, setFormData] = useState({
    title: '',
    price: 0,
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await window.api.invoke('db:run',
        'INSERT INTO properties (title, price, description) VALUES (?, ?, ?)',
        [formData.title, formData.price, formData.description]
      );

      console.log('Property added with ID:', result.lastInsertRowid);
      
      // Reset form
      setFormData({ title: '', price: 0, description: '' });
    } catch (error) {
      console.error('Error adding property:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="العنوان"
      />
      <input
        type="number"
        value={formData.price}
        onChange={(e) => setFormData({ ...formData, price: +e.target.value })}
        placeholder="السعر"
      />
      <textarea
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="الوصف"
      />
      <button type="submit">إضافة</button>
    </form>
  );
}
```

---

### مثال 3: معاملة قاعدة بيانات

```typescript
async function transferBalance(fromUserId: number, toUserId: number, amount: number) {
  try {
    await window.api.invoke('db:transaction', [
      {
        sql: 'UPDATE users SET balance = balance - ? WHERE id = ?',
        params: [amount, fromUserId],
      },
      {
        sql: 'UPDATE users SET balance = balance + ? WHERE id = ?',
        params: [amount, toUserId],
      },
      {
        sql: 'INSERT INTO transactions (from_user, to_user, amount) VALUES (?, ?, ?)',
        params: [fromUserId, toUserId, amount],
      },
    ]);

    console.log('Transfer completed successfully');
  } catch (error) {
    console.error('Transfer failed:', error);
  }
}
```

---

### مثال 4: التعامل مع الملفات

```typescript
async function exportToExcel() {
  try {
    // Get data
    const data = await window.api.invoke('db:query', 'SELECT * FROM properties');

    // Convert to Excel format (using a library)
    const excelData = convertToExcel(data);

    // Let user choose save location
    const savePath = await window.api.invoke('file:select', {
      defaultPath: 'properties.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });

    if (savePath) {
      await window.api.invoke('file:write', savePath, excelData);
      console.log('Exported successfully to:', savePath);
    }
  } catch (error) {
    console.error('Export failed:', error);
  }
}
```

---

## 🔒 أفضل الممارسات

### 1. التعامل مع الأخطاء

```typescript
try {
  const result = await window.api.invoke('db:query', sql, params);
  return result;
} catch (error) {
  console.error('Database error:', error);
  // عرض رسالة للمستخدم
  showErrorNotification('حدث خطأ في قاعدة البيانات');
  return [];
}
```

### 2. التحقق من البيانات

```typescript
// Always validate before sending to main process
if (!formData.title || formData.price <= 0) {
  showErrorNotification('البيانات غير صحيحة');
  return;
}

const result = await window.api.invoke('db:run', sql, params);
```

### 3. استخدام TypeScript Types

```typescript
// Define types for API responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const response = await window.api.invoke<ApiResponse<Property[]>>(
  'properties:getAll'
);
```

---

## 📝 ملاحظات

- جميع عمليات Database تعمل بشكل asynchronous
- استخدم معاملات للعمليات المتعددة المرتبطة
- تحقق دائماً من الأخطاء باستخدام try-catch
- استخدم prepared statements لمنع SQL injection

---

## 🔗 موارد إضافية

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [React Best Practices](https://react.dev/learn)

---

**آخر تحديث:** 2026-01-06

</div>
