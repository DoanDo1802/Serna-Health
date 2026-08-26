import { CultureStat } from '@/types/market';

export const CULTURE_STATS: CultureStat[] = [
  {
    id: 'satisfaction',
    percentage: 99,
    description: 'bệnh nhân và gia đình hài lòng với chất lượng điều trị và thái độ phục vụ tận tâm.',
  },
  {
    id: 'safety',
    percentage: 98,
    description: 'ca phẫu thuật được kiểm soát an toàn tuyệt đối theo tiêu chuẩn nghiêm ngặt JCI.',
  },
  {
    id: 'recovery',
    percentage: 96,
    description: 'người bệnh hồi phục sớm và xuất viện đúng kế hoạch nhờ phác đồ chăm sóc toàn diện.',
  },
];

export const APP_THEME = {
  colors: {
    primary: '#000000',
    background: '#ffffff',
    textMuted: '#757575',
    accentDark: '#121212',
  },
  videoSrc: '/videos/0702.mp4',
  videoPoster: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1920&auto=format&fit=crop',
};
