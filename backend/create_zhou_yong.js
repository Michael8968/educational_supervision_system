const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/lfun/Documents/github/educational_supervision_system/.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://wckdsunsuqcoyvmfjkfq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUser() {
  const phone = '13700137003';
  const password = '137003'; // 手机号后6位

  // 先检查是否已存在
  const { data: existing } = await supabase
    .from('sys_users')
    .select('phone, name')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    console.log('用户已存在，更新密码:', existing);
    const { data, error } = await supabase
      .from('sys_users')
      .update({
        password: password,
        updated_at: new Date().toISOString()
      })
      .eq('phone', phone)
      .select();

    if (error) {
      console.error('更新失败:', error.message);
    } else {
      console.log('密码已更新为:', password);
    }
  } else {
    console.log('创建新用户...');
    const { data, error } = await supabase
      .from('sys_users')
      .insert({
        phone: phone,
        password: password,
        name: '周勇',
        roles: ['data_collector'],
        status: 'active',
        organization: '和平区教育局',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('创建失败:', error.message);
    } else {
      console.log('创建成功:', data);
    }
  }
}

createUser();
