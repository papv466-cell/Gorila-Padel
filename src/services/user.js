function randomId() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  
  export function getOrCreateUserId() {
    const key = "gp:userId";
    let id = localStorage.getItem(key);
  
    if (!id) {
      id = `u_${randomId()}`;
      localStorage.setItem(key, id);
    }
  
    return id;
  }
  