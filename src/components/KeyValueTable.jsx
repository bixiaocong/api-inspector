/** 简单的键值对表格（用于请求头 / 响应头 / Query 参数） */

export default function KeyValueTable({ entries, emptyText = '（无）' }) {
  if (!entries || !entries.length) {
    return <div className="kv-empty">{emptyText}</div>;
  }
  return (
    <table className="kv-table">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td className="kv-key">{key}</td>
            <td className="kv-val" title={String(value)}>
              {String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
