const ResponseColumn = ({ model, response, streaming, className, onRetry }) => {
  return (
    <div className={`response-column ${className}`}>
      <h3 className="model-title">{model}</h3>
      <div className="response-content">
        {streaming ? <LoadingIndicator /> : <p>{response.text}</p>}
      </div>
      {response.error && <p className="error-message">{response.error}</p>}
      <button onClick={() => onRetry(model)}>Retry</button>
    </div>
  );
}; 