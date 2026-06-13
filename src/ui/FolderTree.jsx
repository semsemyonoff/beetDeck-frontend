import Icon from './Icon.jsx';

export default function FolderTree({ root, folder, files, compact }) {
  return (
    <div className={'folder-tree' + (compact ? ' folder-tree-compact' : '')}>
      <div className="folder-tree-head">
        <Icon name="disc" size={12} />
        <span className="folder-tree-root mono">{root}/</span>
        <span className="folder-tree-name mono">{folder}/</span>
        <span className="folder-tree-count">{files.length} files</span>
      </div>
      <div className="folder-tree-files">
        {files.map((f, i) => (
          <div key={i} className="folder-tree-row">
            <span className="folder-tree-stem mono">
              {i === files.length - 1 ? '└─' : '├─'}
            </span>
            <span className="folder-tree-file mono">{f.file}</span>
            <span className="folder-tree-dur mono">{f.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
