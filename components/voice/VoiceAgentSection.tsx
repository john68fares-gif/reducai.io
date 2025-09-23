<div className="mt-4">
  <div className="mb-2 text-[12.5px]">Assistant Language</div>
  <StyledSelect
    value={data.language || 'English'}
    onChange={(v)=>setField('language')(v)}
    options={[
      { value:'English', label:'English' },
      { value:'Deutsch', label:'Deutsch' },
      { value:'Nederlands', label:'Nederlands' },
      { value:'Español', label:'Español' },
      { value:'العربية', label:'العربية' }
    ]}
  />
</div>
